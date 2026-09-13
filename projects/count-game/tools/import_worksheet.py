"""
高照数算题库导入工具
==================
用 parse_worksheet.py 解析图片，将结果直接写入 server/data/worksheets.json 题库。

用法:
    python tools/import_worksheet.py <图片路径> [--date 2026-08-06] [--title 标题]

如果不指定 --date，默认用今天日期。
如果不指定 --title，默认用 "高照数算 <日期>"。

示例:
    python tools/import_worksheet.py 资料分析速算练习2189_2.jpg
    python tools/import_worksheet.py 练习图.png --date 2026-08-07 --title "速算练习第3期"
"""
import os
import sys
import json
import uuid
import time
import argparse
from datetime import date

# 将 tools 目录加入 path 以便 import parse_worksheet
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_worksheet import parse_worksheet  # noqa: E402

# 题库 JSON 文件路径
DATA_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "server", "data", "worksheets.json"
)


def load_worksheets():
    """读取现有题库"""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_worksheets(worksheets):
    """保存题库"""
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(worksheets, f, ensure_ascii=False, indent=2)


def import_worksheet(img_path, ws_date=None, ws_title=None, debug=False):
    """解析图片并导入题库"""
    # 解析图片
    print(f"正在解析图片: {img_path}")
    result = parse_worksheet(img_path, debug=debug)
    questions = result.get("questions", [])
    if not questions:
        print("错误：未识别到题目！")
        return None

    print(f"识别到 {len(questions)} 道题目")

    # 日期
    if not ws_date:
        ws_date = date.today().isoformat()
    # 标题
    if not ws_title:
        ws_title = f"高照数算 {ws_date}"

    # 构建题库条目
    entry = {
        "id": uuid.uuid4().hex[:24],
        "date": ws_date,
        "title": ws_title,
        "source": os.path.basename(img_path),
        "groups": result.get("groups", []),
        "questions": questions,
        "rows": result.get("rows", []),
        "createdAt": int(time.time() * 1000),
    }

    # 读取现有题库，同日期覆盖
    worksheets = load_worksheets()
    before = len(worksheets)
    worksheets = [w for w in worksheets if w.get("date") != ws_date]
    worksheets.append(entry)
    after = len(worksheets)

    # 保存
    save_worksheets(worksheets)

    action = "覆盖" if after == before else "新增"
    print(f"\n{'='*50}")
    print(f"题库已{action}！")
    print(f"  日期: {ws_date}")
    print(f"  标题: {ws_title}")
    print(f"  题目数: {len(questions)}")
    print(f"  题库文件: {DATA_FILE}")
    print(f"  当前题库总数: {after}")
    print(f"{'='*50}")

    # 打印前几道题目预览
    print("\n题目预览（前5题）:")
    for i, q in enumerate(questions[:5]):
        print(f"  {i+1}. {q}")
    if len(questions) > 5:
        print(f"  ... 共 {len(questions)} 题")

    return entry


def main():
    parser = argparse.ArgumentParser(description="导入高照数算题库")
    parser.add_argument("image", help="题目图片路径")
    parser.add_argument("--date", help="日期 (YYYY-MM-DD)，默认今天", default=None)
    parser.add_argument("--title", help="题库标题，默认'高照数算 <日期>'", default=None)
    parser.add_argument("--debug", action="store_true", help="显示解析调试信息")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"错误：文件不存在: {args.image}")
        sys.exit(1)

    entry = import_worksheet(args.image, args.date, args.title, args.debug)
    if entry is None:
        sys.exit(1)


if __name__ == "__main__":
    main()
