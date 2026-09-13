import type { WrongQuestionInput } from '../components/WrongQuestionForm';

/** 将粘贴的图片追加到题干或选项图片数组（纯函数，不修改原状态）。 */
export function appendPastedImage(
  prev: WrongQuestionInput,
  target: 'stem' | 'options',
  dataUrl: string,
): WrongQuestionInput {
  return target === 'options'
    ? { ...prev, optionsImages: [...prev.optionsImages, dataUrl] }
    : { ...prev, stemImages: [...prev.stemImages, dataUrl] };
}
