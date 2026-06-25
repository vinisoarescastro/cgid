from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from dependencies import validar_sessao_middleware
from routers import auth, usuarios, workspaces, permissoes, auditoria, configuracoes, dashboard, landbank, departamentos

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CGID API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.middleware("http")(validar_sessao_middleware)

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(workspaces.router)
app.include_router(permissoes.router)
app.include_router(auditoria.router)
app.include_router(configuracoes.router)
app.include_router(dashboard.router)
app.include_router(landbank.router)
app.include_router(departamentos.router)


@app.on_event("startup")
def startup_event():
    from database import SessionLocal
    from services.auth_service import garantir_permissoes_default, garantir_dados_iniciais
    db = SessionLocal()
    try:
        garantir_permissoes_default(db)
        garantir_dados_iniciais(db)
    finally:
        db.close()


@app.get("/")
def inicio():
    return {"mensagem": "CGID API v2.0 no ar!"}
