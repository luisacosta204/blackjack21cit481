type Props = {
  children: React.ReactNode;
  maxWidth?: number;
};

export default function CenteredMain({ children, maxWidth = 1100 }: Props) {
  return (
    <main
      className="container stack"
      style={{
        minHeight: "calc(100vh - 140px)", // keeps short pages from pulling footer upward
        paddingTop: 48,
        paddingBottom: 48,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth }}>{children}</div>
    </main>
  );
}
