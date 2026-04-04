export default function CityLoading() {
  return (
    <div className="h-screen flex flex-col bg-surface animate-[pageIn_200ms_ease-out]">
      <div className="bg-surface shrink-0" style={{ position: "relative", zIndex: 40 }}>
        <div className="px-4 py-2.5 h-12" />
      </div>
      <div className="flex-1" />
    </div>
  );
}
