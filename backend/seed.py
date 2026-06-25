"""
Popula o banco com dados iniciais.
"""
import uuid
from passlib.context import CryptContext
from database import engine, SessionLocal, Base
from models import Usuario

Base.metadata.create_all(bind=engine)
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
db  = SessionLocal()


def upsert_usuario(nome, email, senha, perfil):
    u = db.query(Usuario).filter(Usuario.email == email).first()
    if not u:
        u = Usuario(
            id         = str(uuid.uuid4()),
            nome       = nome,
            email      = email,
            hash_senha = pwd.hash(senha),
            perfil     = perfil,
            status     = "ativo",
        )
        db.add(u)


print("Inserindo usuario master...")
upsert_usuario("Master", "master@cgid.com", "123456", "master")

db.commit()
db.close()
print("Banco criado e populado com sucesso.")
