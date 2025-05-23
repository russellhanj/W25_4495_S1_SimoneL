from fastapi import APIRouter, HTTPException
from openai import OpenAI
import os
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

chatbot_router = APIRouter()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ChatbotRequest(BaseModel):
    user_message: str
    travel_style: str

class PackingRequest(BaseModel):
    city: str
    temperature: float
    condition: str


def get_system_prompt(travel_style):
    base_prompt = "Your name is Waypointer, a travel assistant for Vancouver, British Columbia, Canada."
    
    style_prompts = {
        "relaxation": "Focus on suggesting quiet, peaceful, and scenic locations like spas, beaches, and tranquil parks. Provide specific place suggestions.",
        "adventure": "Recommend thrilling activities such as hiking, kayaking, zip-lining, and outdoor exploration. Provide specific place suggestions.",
        "cultural": "Suggest historical sites, museums, art galleries, and local cultural experiences. Provide specific place suggestions.",
    }

    additional_prompt = "Please limit to 3 suggestions unless specified in my request. Provide specific place suggestions."
    
    style_message = style_prompts.get(travel_style.lower(), "Provide general travel recommendations.")
    
    return f"{base_prompt} {style_message} {additional_prompt}"

@chatbot_router.post("/")
async def chatbot_interaction(request: ChatbotRequest):
    try:
        system_prompt = get_system_prompt(request.travel_style)

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.user_message}
                 ]
        )
        # Debugging: Add travel style in response to confirm user travel style retrieval
        #response_text = completion.choices[0].message.content
        #formatted_response = f"For {request.travel_style} lovers: {response_text}"
        #return {"response": formatted_response}
        
        return {"response": completion.choices[0].message.content}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@chatbot_router.post("/packing")
async def get_packing_tip(req: PackingRequest):
    prompt = (
        f"You are a helpful travel assistant. Based on this weather: "
        f"{req.temperature}°C, {req.condition.lower()} in {req.city}, "
        f"suggest what a traveler should pack. Keep it short and under 3 sentences."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=80,
        )

        message = response.choices[0].message.content
        return {"status": "success", "packing_tip": message}

    except Exception as e:
        return {"status": "error", "detail": str(e)}
