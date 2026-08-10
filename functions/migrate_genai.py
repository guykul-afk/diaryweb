import re
import sys

def migrate(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace imports
    content = content.replace('import google.generativeai as genai', 'from google import genai\nfrom google.genai import types')
    
    # Replace global cache variables and function
    old_cache_func = """_okf_cache_object = None
_okf_cache_created_at = None

def get_okf_generative_model(api_key: str, system_prompt: str) -> genai.GenerativeModel:
    \"\"\"Helper to return a GenerativeModel utilizing Gemini Context Caching for the OKF base if available.\"\"\"
    global _okf_cache_object, _okf_cache_created_at
    genai.configure(api_key=api_key)
    try:
        from google.generativeai import caching
        now = datetime.datetime.now(datetime.timezone.utc)
        if _okf_cache_object and _okf_cache_created_at and (now - _okf_cache_created_at).total_seconds() < 3300:
            return genai.GenerativeModel.from_cached_content(cached_content=_okf_cache_object)
        
        if len(PSYCHOLOGY_KNOWLEDGE_BASE) > 500:
            logger.info("Creating Gemini Context Cache for OKF Psychology Base...")
            _okf_cache_object = caching.CachedContent.create(
                model='models/gemini-1.5-pro',
                display_name='okf_psychology_base_cache',
                system_instruction=system_prompt,
                contents=[f"=== PSYCHOLOGICAL KNOWLEDGE BASE (OKF) ===\\n{PSYCHOLOGY_KNOWLEDGE_BASE}"],
                ttl=datetime.timedelta(minutes=60)
            )
            _okf_cache_created_at = now
            return genai.GenerativeModel.from_cached_content(cached_content=_okf_cache_object)
    except Exception as e:
        logger.warning(f"Gemini Context Caching fallback to standard model generation: {e}")
        
    return genai.GenerativeModel(
        model_name="gemini-1.5-pro",
        system_instruction=system_prompt
    )"""
    new_cache_func = """_okf_cache_object = None
_okf_cache_created_at = None

def get_okf_cached_content(client: genai.Client, system_prompt: str):
    global _okf_cache_object, _okf_cache_created_at
    now = datetime.datetime.now(datetime.timezone.utc)
    if _okf_cache_object and _okf_cache_created_at and (now - _okf_cache_created_at).total_seconds() < 3300:
        return _okf_cache_object
    
    if len(PSYCHOLOGY_KNOWLEDGE_BASE) > 500:
        try:
            logger.info("Creating Gemini Context Cache for OKF Psychology Base...")
            _okf_cache_object = client.caches.create(
                model="gemini-2.0-flash",
                config=types.CreateCachedContentConfig(
                    system_instruction=system_prompt,
                    contents=[f"=== PSYCHOLOGICAL KNOWLEDGE BASE (OKF) ===\\n{PSYCHOLOGY_KNOWLEDGE_BASE}"],
                    ttl="3600s",
                    display_name="okf_psychology_base_cache"
                )
            )
            _okf_cache_created_at = now
            return _okf_cache_object
        except Exception as e:
            logger.warning(f"Gemini Context Caching fallback failed: {e}")
            
    return None"""
    content = content.replace(old_cache_func, new_cache_func)

    # Replace _call_gemini
    old_call_gemini = """def _call_gemini(text: str, system_prompt: str, lens_id: str, max_tokens: int = 1500, is_json: bool = False) -> str:
    \"\"\"Helper function to call Gemini model for an individual agent.\"\"\"
    try:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured.")
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-pro",
            system_instruction=system_prompt
        )
        generation_config = {"temperature": 0.2}
        if max_tokens:
            generation_config["max_output_tokens"] = max_tokens
        if is_json:
            generation_config["response_mime_type"] = "application/json"
            
        safety_settings = [
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
        
        response = model.generate_content(
            text,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        return response.text
    except Exception as e:
        logger.error(f"Error calling gemini for lens {lens_id}: {e}")
        return "{}" if is_json else \"\""""
        
    new_call_gemini = """def _call_gemini(text: str, system_prompt: str, lens_id: str, max_tokens: int = 1500, is_json: bool = False) -> str:
    \"\"\"Helper function to call Gemini model for an individual agent.\"\"\"
    try:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured.")
        
        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.2,
            safety_settings=[
                types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
                types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
                types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
                types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE")
            ]
        )
        if max_tokens:
            config.max_output_tokens = max_tokens
        if is_json:
            config.response_mime_type = "application/json"
            
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=text,
            config=config
        )
        return response.text
    except Exception as e:
        logger.error(f"Error calling gemini for lens {lens_id}: {e}")
        return "{}" if is_json else \"\""""
    content = content.replace(old_call_gemini, new_call_gemini)
    
    # Replace embed_text
    old_embed_text = """def embed_text(text: str) -> List[float]:
    \"\"\"Generate embeddings for a given text.\"\"\"
    if not text:
        return []
    try:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("No API key for embeddings")
            return []
        genai.configure(api_key=api_key)
        # Using text-embedding-004 with fallback
        try:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
        except Exception:
            result = genai.embed_content(
                model="models/embedding-001",
                content=text,
                task_type="retrieval_document"
            )
        return result.get('embedding', [])
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return []"""
    new_embed_text = """def embed_text(text: str) -> List[float]:
    \"\"\"Generate embeddings for a given text.\"\"\"
    if not text:
        return []
    try:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("No API key for embeddings")
            return []
        client = genai.Client(api_key=api_key)
        result = client.models.embed_content(
            model="text-embedding-004",
            contents=text,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
        )
        return result.embeddings[0].values
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return []"""
    content = content.replace(old_embed_text, new_embed_text)

    # Replace orchestrator block
    old_orchestrator = """        # 8. Orchestrator Processing
        orchestrator_prompt = f\"\"\"
=== DOCUMENTS / ENTRIES ===
{documents_text}

=== EXISTING GRAPH NODES ===
{existing_nodes_context}

{selected_lenses_context}
\"\"\"
        orchestrator_response = orchestrator_model.generate_content(
            orchestrator_prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=OrchestratorOutput,
                temperature=0.2
            )
        )
        
        orchestrator_output = OrchestratorOutput.model_validate_json(orchestrator_response.text)"""
    new_orchestrator = """        # 8. Orchestrator Processing
        orchestrator_prompt = f\"\"\"
=== DOCUMENTS / ENTRIES ===
{documents_text}

=== EXISTING GRAPH NODES ===
{existing_nodes_context}

{selected_lenses_context}
\"\"\"
        
        client = genai.Client(api_key=api_key)
        cached_content = get_okf_cached_content(client, orchestrator_system_prompt)
        
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=OrchestratorOutput,
            temperature=0.2
        )
        if cached_content:
            config.cached_content = cached_content.name
        else:
            config.system_instruction = orchestrator_system_prompt
            
        orchestrator_response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=orchestrator_prompt,
            config=config
        )
        
        orchestrator_output = OrchestratorOutput.model_validate_json(orchestrator_response.text)"""
    content = content.replace(old_orchestrator, new_orchestrator)
    
    # Remove old orchestrator model instantiation
    old_instantiation = """        # 7. Orchestrator Model Instantiation
        orchestrator_system_prompt = load_okf_psychology_core() + "\\n" + ORCHESTRATOR_SYSTEM_PROMPT
        orchestrator_model = get_okf_generative_model(api_key, orchestrator_system_prompt)
"""
    new_instantiation = """        # 7. Orchestrator System Prompt
        orchestrator_system_prompt = load_okf_psychology_core() + "\\n" + ORCHESTRATOR_SYSTEM_PROMPT
"""
    content = content.replace(old_instantiation, new_instantiation)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Migration complete.")

if __name__ == '__main__':
    migrate(sys.argv[1])
