from pydantic import BaseModel


class SearchResultItem(BaseModel):
    type: str  # cliente | contato | produto | tarefa | risco
    id: str
    label: str
    subtitle: str | None = None
    client_id: str | None = None


class SearchResultsOut(BaseModel):
    query: str
    results: list[SearchResultItem]
