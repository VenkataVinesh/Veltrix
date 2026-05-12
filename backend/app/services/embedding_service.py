import hashlib
import math


def embed_text(text: str, dims: int = 32) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    vec: list[float] = []
    for i in range(dims):
        b = digest[i % len(digest)]
        vec.append((b / 255.0) * 2 - 1)
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]
