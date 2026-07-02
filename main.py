from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import roblox
import os
import requests

app = FastAPI()

GROUP_ID = int(os.getenv("GROUP_ID", 972348115))
COOKIE = os.getenv("ROBLOX_COOKIE")
OYUN_PLACE_ID = os.getenv("OYUN_PLACE_ID", "138257110169831")

roblox_client = roblox.Client()

@app.on_event("startup")
async def startup():
    await roblox_client.set_cookie(COOKIE)

@app.get("/durum")
async def durum():
    try:
        user = await roblox_client.get_authenticated_user()
        return {"aktif": True, "username": user.name}
    except:
        return {"aktif": False}

@app.get("/roles")
async def get_roles():
    """ /rütbeler komutu için - tüm rütbeler + üye sayısı """
    try:
        group = await roblox_client.get_group(GROUP_ID)
        roles = await group.get_roles()
        data = []
        for role in roles:
            data.append({
                "name": role.name,
                "rank": role.rank,
                "memberCount": role.member_count
            })
        return sorted(data, key=lambda x: x["rank"], reverse=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/aktiflik")
async def aktiflik_sorgu():
    """ /aktiflik-sorgu komutu için - oyundaki aktif sayısı """
    try:
        url = f"https://games.roblox.com/v1/games?universeIds={OYUN_PLACE_ID}"
        res = requests.get(url).json()
        data = res['data'][0]
        return {
            "aktif": data['playing'],
            "isim": data['name'],
            "maxOyuncu": data['maxPlayers']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RankRequest(BaseModel):
    username: str
    rank_id: int
    reason: str

@app.post("/set-rank")
async def set_rank(req: RankRequest):
    """ /rütbe-değiştir komutu için """
    try:
        user = await roblox_client.get_user_by_username(req.username)
        await roblox_client.set_rank(GROUP_ID, user.id, req.rank_id)
        return {"success": True, "message": f"{req.username} rütbesi değiştirildi"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
