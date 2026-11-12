---
id: diy-vectorization
type: 场景题
difficulty: medium
tags: [向量化, 知识库, embedding]
sources: [chatgpt]
date: 2026-11-12
---

## 题目
dify免费版知识库只支持1个文件，我想自己做向量化，不用dify，该怎么做

## 回答
可以。你自己调用 embedding 模型生成向量，再存到向量库，就完全不依赖 Dify。也不需要训练模型。

建议你先用这套最小方案：

组件	选择	负责什么
开发语言	Python	读取文件、切片、调用模型
本地模型服务	Ollama	运行 embedding 模型
Embedding 模型	bge-m3	把中文文本转换成向量
向量库	Chroma	保存向量、检索相似片段

bge-m3 支持多语言，Ollama 官方提供直接调用示例；Chroma 支持本地持久化，不需要另外部署数据库服务。
+1

**这次先完成“多个文件导入 → 向量化 → 检索原文”。预计 1–2 小时，不含安装和下载时间。**完成标准是：输入一个问题，找到相关文件里的内容。后面再加大模型回答，组成完整 RAG。

第一步：把两个概念分清楚。

导入时：

文件 → 提取文字 → 切成片段 → embedding 模型生成向量 → 保存原文、向量、来源

查询时：

用户问题 → 同一个 embedding 模型生成向量 → 向量库找相似片段 → 返回原文

**Embedding 模型负责检索，聊天模型负责生成回答。**当前这一步只需要 embedding 模型。

第二步：准备环境。

在 Mac 上安装并启动 Ollama，然后下载模型：

Bash
ollama pull bge-m3

测试能否生成向量：

Bash
curl http://localhost:11434/api/embed \
  -H 'Content-Type: application/json' \
  -d '{"model":"bge-m3","input":"如何排查服务内存持续增长？"}'

返回 JSON 中有 embeddings 数组，就说明成功。这个接口支持一次传入多个文本；下面会用它批量处理。
GitHub

创建项目和 Python 环境：

Bash
mkdir local-kb
cd local-kb

python3 -m venv .venv
source .venv/bin/activate

python -m pip install -U chromadb requests pypdf python-docx
mkdir docs

把文件放进 docs 目录，支持 .txt、`.md`、文本型 .pdf、`.docx`，也支持子目录。

第三步：新建 kb.py，放入下面的代码。

这是本地学习版：按字符切片、批量向量化、保存到磁盘，并支持重复导入。

Python
import sys
from pathlib import Path

import chromadb
import requests
from docx import Document
from pypdf import PdfReader

BASE = Path(__file__).resolve().parent
DOCS = BASE / "docs"
MODEL = "bge-m3"
BATCH = 16

client = chromadb.PersistentClient(path=str(BASE / "vector_db"))
collection = client.get_or_create_collection(
    name="kb-bge-m3",
    embedding_function=None,  # 我们自己生成向量
    configuration={"hnsw": {"space": "cosine"}},
)


def embed(texts):
    response = requests.post(
        "http://localhost:11434/api/embed",
        json={
            "model": MODEL,
            "input": texts,
            "truncate": False,
        },
        timeout=180,
    )
    response.raise_for_status()
    vectors = response.json()["embeddings"]
    if len(vectors) != len(texts):
        raise RuntimeError("返回的向量数量与文本数量不一致")
    return vectors


def read_text(path):
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md"}:
        return path.read_text(encoding="utf-8")
    if suffix == ".pdf":
        return "\n\n".join(
            page.extract_text() or ""
            for page in PdfReader(str(path)).pages
        )
    if suffix == ".docx":
        doc = Document(str(path))
        paragraphs = [p.text for p in doc.paragraphs]
        tables = [
            " | ".join(cell.text for cell in row.cells)
            for table in doc.tables
            for row in table.rows
        ]
        return "\n".join(paragraphs + tables)
    return ""


def split_text(text, size=600, overlap=100):
    # 相邻片段保留部分重叠，减少边界处上下文丢失
    return [
        part
        for start in range(0, len(text), size - overlap)
        if (part := text[start:start + size].strip())
    ]


def index_files():
    extensions = {".txt", ".md", ".pdf", ".docx"}
    files = [
        p for p in sorted(DOCS.rglob("*"))
        if p.is_file() and p.suffix.lower() in extensions
    ]
    if not files:
        print("docs 目录里没有支持的文件")
        return

    for path in files:
        source = path.relative_to(DOCS).as_posix()
        chunks = split_text(read_text(path))
        if not chunks:
            print(f"跳过无文本文件：{source}")
            continue

        # 先生成全部向量，避免模型失败时清掉已有数据
        vectors = []
        for start in range(0, len(chunks), BATCH):
            vectors.extend(embed(chunks[start:start + BATCH]))

        # 重建这个文件的记录，避免文件变短后残留旧片段
        collection.delete(where={"source": source})
        for start in range(0, len(chunks), BATCH):
            end = min(start + BATCH, len(chunks))
            collection.upsert(
                ids=[f"{source}:{i}" for i in range(start, end)],
                documents=chunks[start:end],
                embeddings=vectors[start:end],
                metadatas=[
                    {"source": source, "chunk": i}
                    for i in range(start, end)
                ],
            )
        print(f"已导入：{source}，{len(chunks)} 个片段")

    print(f"库中共有 {collection.count()} 个片段")


def search(question):
    count = collection.count()
    if count == 0:
        print("知识库为空，请先执行 index")
        return

    result = collection.query(
        query_embeddings=embed([question]),
        n_results=min(3, count),
        include=["documents", "metadatas", "distances"],
    )
    for number, (text, meta, distance) in enumerate(
        zip(
            result["documents"][0],
            result["metadatas"][0],
            result["distances"][0],
        ),
        start=1,
    ):
        print(
            f"\n[{number}] 来源：{meta['source']} "
            f"片段：{meta['chunk']} 距离：{distance:.4f}"
        )
        print(text)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "index":
        index_files()
    elif len(sys.argv) >= 3 and sys.argv[1] == "search":
        search(" ".join(sys.argv[2:]))
    else:
        print('用法：python kb.py index')
        print('      python kb.py search "你的问题"')

Chroma 的持久化、手动传入向量和余弦距离配置，都有官方接口支持。
Chroma Docs
+1

第四步：导入和查询。

批量导入：

Bash
python kb.py index

检索：

Bash
python kb.py search "服务发生 OOM 后应该怎么排查？"

它会返回最多三个相关片段，以及文件来源。向量和原文保存在 vector_db 目录，关闭程序后仍然存在。

修改文件后重新执行 index，会重建对应文件的片段。删除文件不会自动删除库中的记录；这份代码也没有增量检测，所以重复运行会重新计算文件向量。

跑通后，再加完整 RAG。

拿检索出来的片段，交给公司允许使用的聊天模型：

请根据以下资料回答问题，并引用资料编号。资料没有提供答案时，明确说明未找到依据。
资料：[1]…… [2]……
问题：……

这样你就拥有自己的知识库问答链路。生成答案可以用本地模型，也可以用获准的模型 API，跟向量库选择没有绑定关系。

先留意四点：

**文档和问题必须使用同一个 embedding 模型。**换模型后要重新建库，不能混用向量。
**返回最近的片段，不代表资料一定包含答案。**距离不是回答正确率，需要用实际问题检查效果。
**扫描 PDF、图片和复杂表格需要额外解析。**上面的代码没有 OCR，Word 表格也只是简单转成文本。
**600 字、重叠 100 字只是起步参数。**先测试约 20 个真实问题，观察答案所在段落是否被检索到，再调整。

对你当前补 RAG 能力的目标，先把这个版本跑通很合适。第一轮只检查检索原文是否正确，检索有问题时先修它，再接聊天模型。
