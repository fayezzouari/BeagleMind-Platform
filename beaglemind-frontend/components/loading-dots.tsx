export function LoadingDots() {
  return (
    <div className="flex items-center space-x-1">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce"></div>
      </div>
      <span className="text-slate-400 ml-2">BeagleMind is thinking...</span>
    </div>
  );
}
