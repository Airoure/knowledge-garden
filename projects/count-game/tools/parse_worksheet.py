"""
速算练习工作表图片解析工具
=========================
解析「公考高照速算技巧练习」类图片，自动识别表头运算符，
将 A、B 数值与运算符组合生成完整题目字符串。

用法:
    python parse_worksheet.py <图片路径> [-o 输出.json] [--debug]

依赖:
    pip install opencv-python-headless pillow pytesseract numpy
    需安装 Tesseract OCR (含 chi_sim 语言包)

输出 JSON 结构:
{
  "title": "...",
  "source": "sample.png",
  "questions": [
    "25×6", "45×5", "57+64", "57-64",   // 第1行
    ...
  ],
  "rows": [
    {"row": 1, "questions": ["25×6", "45×5", "57+64", "57-64"]},
    ...
  ]
}
"""
import os
import re
import sys
import json
import argparse

import cv2
import numpy as np
import pytesseract

# ---------- Tesseract 配置 ----------
_TESS_CANDIDATES = [
    os.environ.get("TESSERACT_CMD", ""),
    r"C:\Users\zjl\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\vm\tools\app\tesseract\tesseract.exe",
    "tesseract",
]
for _c in _TESS_CANDIDATES:
    if _c and os.path.exists(_c):
        pytesseract.pytesseract.tesseract_cmd = _c
        _tessdata = os.path.join(os.path.dirname(_c), "tessdata")
        if os.path.isdir(_tessdata):
            os.environ["TESSDATA_PREFIX"] = _tessdata
        break


def detect_grid_lines(gray):
    """检测表格线，返回 (row_ys, col_xs) 坐标列表。"""
    h, w = gray.shape[:2]
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 15
    )
    horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 20, 1))
    horiz = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horiz_kernel, iterations=2)
    vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, h // 30))
    vert = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vert_kernel, iterations=2)

    row_ys = _project_to_coords(horiz.sum(axis=1), h)
    col_xs = _project_to_coords(vert.sum(axis=0), w)
    return row_ys, col_xs


def _project_to_coords(proj, length):
    thresh = proj.max() * 0.3 if proj.max() > 0 else 0
    coords = []
    in_line = False
    start = 0
    for i, v in enumerate(proj):
        if v > thresh and not in_line:
            start = i
            in_line = True
        elif v <= thresh and in_line:
            coords.append((start + i) // 2)
            in_line = False
    if in_line:
        coords.append((start + length) // 2)
    return coords


def ocr_cell(cell_gray, scale=4, pad=6, digits_only=True):
    """OCR 单个单元格。digits_only=True 时只返回数字。"""
    padded = cv2.copyMakeBorder(
        cell_gray, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=255
    )
    big = cv2.resize(
        padded, (padded.shape[1] * scale, padded.shape[0] * scale),
        interpolation=cv2.INTER_CUBIC,
    )
    thr = cv2.adaptiveThreshold(
        big, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )
    if digits_only:
        cfg = "--psm 7 -c tessedit_char_whitelist=0123456789"
    else:
        cfg = "--psm 7"
    try:
        txt = pytesseract.image_to_string(thr, config=cfg, lang="chi_sim")
    except Exception:
        txt = ""
    return txt.strip().replace(" ", "").replace("\n", "")


def detect_operator(header_text):
    """
    从表头文字中识别运算符。
    返回运算符字符: +, -, ×, ÷, 或 None（如果是 A/B 纯操作数列）。
    """
    # 统一常见 OCR 误读
    t = header_text.lower().replace("x", "×").replace("*", "×").replace("8", "")
    # 只含 A/B 的是操作数列
    if re.fullmatch(r"[ab]+", t):
        return None
    # 检测运算符
    if "×" in t or "x" in header_text.lower():
        return "×"
    if "÷" in t or "/" in t:
        return "÷"
    if "+" in t:
        return "+"
    if "-" in t or "—" in t:
        return "-"
    return None


def parse_headers(gray, row_ys, col_xs):
    """
    OCR 表头行，识别每列是操作数(A/B)还是运算列。
    返回 groups: [(a_col, b_col, [op_col, ...]), ...]
    """
    hdr_y0, hdr_y1 = row_ys[0], row_ys[1]
    n_cols = len(col_xs) - 1
    headers = []
    for ci in range(n_cols):
        x0, x1 = col_xs[ci], col_xs[ci + 1]
        cell = gray[hdr_y0 + 2 : hdr_y1 - 2, x0 + 2 : x1 - 2]
        txt = ocr_cell(cell, digits_only=False)
        op = detect_operator(txt)
        headers.append({"col": ci, "text": txt, "op": op})
        if __debug__:
            pass

    # 分组：A, B 后面跟着 1+ 个运算列
    groups = []
    i = 0
    while i < len(headers):
        # 找 A 列（op==None 且文字含 a 或为空）
        if headers[i]["op"] is None:
            a_col = i
            # 下一列应为 B
            if i + 1 < len(headers) and headers[i + 1]["op"] is None:
                b_col = i + 1
                # 收集后续运算列
                op_cols = []
                j = i + 2
                while j < len(headers) and headers[j]["op"] is not None:
                    op_cols.append({"col": j, "op": headers[j]["op"]})
                    j += 1
                if op_cols:
                    groups.append({
                        "a_col": a_col,
                        "b_col": b_col,
                        "ops": op_cols,
                    })
                    i = j
                    continue
        i += 1

    return groups, headers


def parse_worksheet(img_path, debug=False):
    """主解析函数。"""
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(f"无法读取图片: {img_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]

    row_ys, col_xs = detect_grid_lines(gray)

    if debug:
        print(f"水平线 {len(row_ys)} 条: {row_ys}")
        print(f"垂直线 {len(col_xs)} 条: {col_xs}")
        print(f"列数: {len(col_xs)-1}, 行数: {len(row_ys)-1}")

    if len(row_ys) < 3 or len(col_xs) < 4:
        raise ValueError("表格线检测失败，请检查图片质量")

    # 解析表头
    groups, headers = parse_headers(gray, row_ys, col_xs)

    if debug:
        print("\n=== 表头识别 ===")
        for hd in headers:
            print(f"  col {hd['col']}: text='{hd['text']}' op={hd['op']}")
        print(f"\n=== 分组 ({len(groups)} 组) ===")
        for gi, g in enumerate(groups):
            ops_str = ", ".join(f"col{op['col']}={op['op']}" for op in g["ops"])
            print(f"  组{gi+1}: A=col{g['a_col']} B=col{g['b_col']} ops=[{ops_str}]")

    # 数据行: row_ys[1] 到 row_ys[-1]
    n_data_rows = len(row_ys) - 2  # 减去表头行和最后一条线

    # OCR 每个数据行的 A、B 列
    all_rows = []
    all_questions = []
    for ri in range(1, len(row_ys)):
        y0, y1 = row_ys[ri], row_ys[ri + 1] if ri + 1 < len(row_ys) else h
        row_questions = []
        for g in groups:
            # OCR A
            x0, x1 = col_xs[g["a_col"]], col_xs[g["a_col"] + 1]
            a_val = ocr_cell(gray[y0 + 2 : y1 - 2, x0 + 2 : x1 - 2])
            # OCR B
            x0, x1 = col_xs[g["b_col"]], col_xs[g["b_col"] + 1]
            b_val = ocr_cell(gray[y0 + 2 : y1 - 2, x0 + 2 : x1 - 2])
            # 生成题目
            for op_info in g["ops"]:
                q = f"{a_val}{op_info['op']}{b_val}"
                row_questions.append(q)
                all_questions.append(q)
        all_rows.append({"row": ri, "questions": row_questions})

        if debug:
            print(f"  行{ri}: {row_questions}")

    result = {
        "source": os.path.basename(img_path),
        "groups": [
            {
                "a_col": g["a_col"],
                "b_col": g["b_col"],
                "operators": [op["op"] for op in g["ops"]],
            }
            for g in groups
        ],
        "questions": all_questions,
        "rows": all_rows,
    }
    return result


def main():
    parser = argparse.ArgumentParser(description="解析速算练习工作表图片")
    parser.add_argument("image", help="图片路径")
    parser.add_argument("-o", "--output", help="输出 JSON 路径")
    parser.add_argument("--debug", action="store_true", help="输出调试信息")
    args = parser.parse_args()

    result = parse_worksheet(args.image, debug=args.debug)
    output = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"结果已保存到: {args.output}")
    else:
        print(output)


if __name__ == "__main__":
    main()
