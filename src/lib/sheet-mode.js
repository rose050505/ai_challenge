import { createContext, useContext } from 'react'

/**
 * 서식 조각이 지금 어디에 그려지고 있는지.
 *
 *  'screen'  — 사용자가 보고 채우는 화면. 입력칸이 보인다. (인쇄도 이 DOM 이 나간다)
 *  'measure' — 페이지 분할용 숨은 측정 영역. **인쇄 결과와 같은 모양**이어야 한다.
 *              즉 입력칸 대신 값 span, 체크박스 대신 글리프를 그린다.
 *              @media print 변형(print:hidden 등)은 화면에서 켜지지 않으므로
 *              여기서 직접 같은 모양을 만들어야 측정이 맞는다.
 */
export const SheetModeContext = createContext('screen')

export const useSheetMode = () => useContext(SheetModeContext)
