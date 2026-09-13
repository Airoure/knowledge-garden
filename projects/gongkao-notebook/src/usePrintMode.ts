import { useEffect, useState } from 'react';

/**
 * 浏览器打印支持。
 * 返回 [printing, startPrint]：
 * - printing：打印期间为 true（⌘P / window.print 会触发 beforeprint），用于展开折叠内容
 * - startPrint：先置 printing=true 等 React 渲染完展开内容，再调起打印对话框（导出 PDF 按钮用）
 */
export function usePrintMode(): [boolean, () => void] {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const on = () => setPrinting(true);
    const off = () => setPrinting(false);
    window.addEventListener('beforeprint', on);
    window.addEventListener('afterprint', off);
    return () => {
      window.removeEventListener('beforeprint', on);
      window.removeEventListener('afterprint', off);
    };
  }, []);

  const startPrint = () => {
    setPrinting(true);
    // 等 React 提交展开内容后再调起打印，避免快照缺少折叠部分
    window.setTimeout(() => window.print(), 50);
  };

  return [printing, startPrint];
}
