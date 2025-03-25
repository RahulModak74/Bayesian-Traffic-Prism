For organizations interested in implementing a similar approach, below are practical code examples showing how we integrated AI APIs into our security platform:

### Basic AI API Integration for Session Analysis

```python
import requests
import json
from typing import Dict, Any
import time

def analyze_session_with_ai(session_data: Dict[Any, Any], cache_client=None) -> Dict[str, Any]:
    """
    Analyze a web session using DeepSeek AI API with caching for efficiency.
    
    Args:
        session_data: Dictionary containing session information
        cache_client: Optional Redis or similar caching client
        
    Returns:
        Dictionary with risk assessment results
    """
    # Generate cache key based on session fingerprint
    cache_key = f"ai_analysis:{generate_session_fingerprint(session_data)}"
    
    # Check cache first
    if cache_client:
        cached_result = cache_client.get(cache_key)
        if cached_result:
            return json.loads(cached_result)
    
    # Prepare the prompt for the AI model
    prompt = format_session_for_analysis(session_data)
    
    # Call the DeepSeek API
    response = requests.post(
        "https://api.deepseek.com/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        },
        json={
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "You are a cybersecurity expert analyzing web session data."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.1,  # Low temperature for consistent outputs
            "max_tokens": 500
        },
        timeout=3.0  # Short timeout to maintain performance
    )
    
    # Parse the structured response
    analysis_result = parse_ai_response(response.json())
    
    # Cache result for future use
    if cache_client:
        cache_client.set(
            cache_key,
            json.dumps(analysis_result),
            ex=3600  # 1 hour expiration
        )
    
    return analysis_result

def format_session_for_analysis(session_data: Dict[Any, Any]) -> str:
    """Format session data into a structured prompt for the AI model."""
    return f"""
    Analyze this web session for potential security threats:
    
    Browser Fingerprint:
    - User Agent: {session_data.get('user_agent', 'Unknown')}
    - Screen Resolution: {session_data.get('screen_resolution', 'Unknown')}
    - Browser Plugins: {session_data.get('plugins', [])}
    - WebDriver Detected: {session_data.get('webdriver_detected', False)}
    
    Behavior Metrics:
    - Navigation Pattern: {session_data.get('navigation_pattern', [])}
    - Mouse Movement Entropy: {session_data.get('mouse_entropy', 0)}
    - Input Timing Variance: {session_data.get('input_timing_variance', 0)}
    
    Request Patterns:
    - Request Timing: {session_data.get('request_timing', [])}
    - Suspicious Parameters: {session_data.get('suspicious_params', [])}
    - Accessed Resources: {session_data.get('resources_accessed', [])}
    
    Analyze if this appears to be a bot, specifically:
    1. Is this likely a bot or human? (Yes/No)
    2. Confidence level (0-100)
    3. Bot type if detected (e.g., "headless browser", "automation tool", "custom script")
    4. Risk level (Low/Medium/High/Critical)
    5. Key indicators that influenced your decision
    
    Format your response as a JSON object.
    """

def parse_ai_response(response_json: Dict[Any, Any]) -> Dict[str, Any]:
    """Extract structured data from the AI response."""
    try:
        content = response_json["choices"][0]["message"]["content"]
        # Extract JSON from response text - handle both when AI returns pure JSON or JSON within text
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = content[json_start:json_end]
            analysis = json.loads(json_str)
        else:
            # Fallback parsing if JSON extraction fails
            analysis = {
                "is_bot": "yes" in content.lower() and "bot" in content.lower(),
                "confidence": extract_confidence(content),
                "bot_type": extract_bot_type(content),
                "risk_level": extract_risk_level(content),
                "indicators": extract_indicators(content)
            }
        
        return {
            "is_bot": analysis.get("is_bot", False),
            "confidence": analysis.get("confidence", 0) / 100,  # Normalize to 0-1
            "bot_type": analysis.get("bot_type", "unknown"),
            "risk_level": analysis.get("risk_level", "low"),
            "indicators": analysis.get("indicators", []),
            "ai_processing_time": time.time() - response_json.get("created", time.time())
        }
    except Exception as e:
        # Graceful fallback if parsing fails
        return {
            "is_bot": False,
            "confidence": 0,
            "bot_type": "unknown",
            "risk_level": "low",
            "indicators": [f"Error parsing AI response: {str(e)}"],
            "error": True
        }
```

### Combining With OLAP Analytics for a Dual Risk Engine

```python
def evaluate_session_risk(session_data, olap_client, ai_client, cache_client=None):
    """
    Implement a dual risk engine combining OLAP and AI analysis.
    This matches our 'Dual risk engine with Bayesian integration of AI/ML and OLAP analytics'.
    """
    # Extract session ID for tracking
    session_id = session_data.get("session_id", "unknown")
    
    # First, check if this is an obvious case our OLAP engine can handle
    olap_start = time.time()
    olap_result = olap_client.analyze_session(session_data)
    olap_time = time.time() - olap_start
    
    # If OLAP gives high confidence result, we can skip AI analysis
    if olap_result.get("confidence", 0) > 0.9:
        return {
            "session_id": session_id,
            "is_threat": olap_result.get("is_threat", False),
            "risk_score": olap_result.get("risk_score", 0),
            "risk_factors": olap_result.get("risk_factors", []),
            "analysis_source": "olap",
            "processing_time_ms": int(olap_time * 1000)
        }
    
    # For ambiguous cases, get AI analysis
    ai_start = time.time()
    ai_result = analyze_session_with_ai(session_data, cache_client)
    ai_time = time.time() - ai_start
    
    # Combine the results using our Bayesian model
    combined_risk = bayesian_risk_integration(
        olap_risk=olap_result.get("risk_score", 0),
        olap_confidence=olap_result.get("confidence", 0),
        ai_is_bot=ai_result.get("is_bot", False),
        ai_confidence=ai_result.get("confidence", 0),
        ai_risk_level=ai_result.get("risk_level", "low")
    )
    
    total_time = olap_time + ai_time
    
    # Create final risk assessment
    return {
        "session_id": session_id,
        "is_threat": combined_risk > 0.65,  # Threshold for threat determination
        "risk_score": combined_risk,
        "risk_factors": olap_result.get("risk_factors", []) + ai_result.get("indicators", []),
        "analysis_source": "combined",
        "bot_type": ai_result.get("bot_type", "unknown") if ai_result.get("is_bot", False) else "human",
        "processing_time_ms": int(total_time * 1000),
        "olap_processing_time_ms": int(olap_time * 1000),
        "ai_processing_time_ms": int(ai_time * 1000)
    }
```

### Fast Response Framework for Real-Time Protection

```python
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
import asyncio
import time

app = FastAPI()

class SessionData(BaseModel):
    session_id: str
    client_data: dict
    user_behavior: dict
    request_information: dict

# In-memory response cache for ultra-fast repeat decisions
response_cache = {}

@app.post("/analyze")
async def analyze_session(session: SessionData, background_tasks: BackgroundTasks):
    """
    Real-time session analysis endpoint with immediate response and background processing.
    This implementation supports our 'Real-Time Action Framework: Sub-second decision making'.
    """
    start_time = time.time()
    session_id = session.session_id
    
    # Check if we have a cached decision for very similar sessions
    cache_key = generate_cache_key(session.dict())
    if cache_key in response_cache:
        cached_result = response_cache[cache_key]
        # Update cache statistics
        cached_result["cache_hits"] += 1
        cached_result["last_access"] = time.time()
        return {
            "session_id": session_id,
            "action": cached_result["action"],
            "risk_score": cached_result["risk_score"],
            "response_time_ms": int((time.time() - start_time) * 1000),
            "source": "cache"
        }
    
    # Quick OLAP check for obvious cases (very fast)
    quick_result = quick_olap_check(session.dict())
    
    if quick_result["is_obvious"]:
        # We have a clear decision without needing AI
        action = "block" if quick_result["is_threat"] else "allow"
        risk_score = 0.95 if quick_result["is_threat"] else 0.05
        
        # Cache this result for similar sessions
        response_cache[cache_key] = {
            "action": action,
            "risk_score": risk_score,
            "cache_hits": 1,
            "last_access": time.time()
        }
        
        # Still do full analysis in background for logging/improvement
        background_tasks.add_task(full_risk_analysis, session.dict())
        
        return {
            "session_id": session_id,
            "action": action,
            "risk_score": risk_score,
            "response_time_ms": int((time.time() - start_time) * 1000),
            "source": "quick_analysis"
        }
    
    # For ambiguous cases, we need more analysis but still need to respond quickly
    # Return a preliminary decision and continue processing in background
    preliminary_result = preliminary_risk_assessment(session.dict())
    action = determine_action(preliminary_result["risk_score"])
    
    # Start full analysis in background
    background_tasks.add_task(full_risk_analysis, session.dict())
    
    return {
        "session_id": session_id,
        "action": action,
        "risk_score": preliminary_result["risk_score"],
        "confidence": preliminary_result["confidence"],
        "response_time_ms": int((time.time() - start_time) * 1000),
        "source": "preliminary_analysis"
    }

async def full_risk_analysis(session_data):
    """Complete full dual-engine analysis in background."""
    try:
        # This runs after responding to the client
        result = await asyncio.to_thread(
            evaluate_session_risk, 
            session_data, 
            olap_client, 
            ai_client, 
            cache_client
        )
        
        # Update our models and cache with this result
        update_risk_models(result)
        
        # Cache the result for future similar sessions
        cache_key = generate_cache_key(session_data)
        response_cache[cache_key] = {
            "action": determine_action(result["risk_score"]),
            "risk_score": result["risk_score"],
            "cache_hits": 1,
            "last_access": time.time()
        }
        
        # Clean cache periodically to prevent memory issues
        if len(response_cache) > 10000:
            clean_old_cache_entries()
            
    except Exception as e:
        # Log error but don't affect user experience
        print(f"Background analysis error: {str(e)}")
