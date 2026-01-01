import { initChessApp } from "./chess-app-core.js";

export function initApp() {
  // removed inline 3D chess implementation; delegating to initChessApp()
  return initChessApp();
}