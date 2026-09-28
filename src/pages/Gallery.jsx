export default function Gallery() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1>My take on a Static Volumetric Viewer</h1>
      </header>
      
      {/* The interactive grid of thumbnails will be mapped here */}
      <main>
        <p>Loading available scenes...</p>
      </main>
    </div>
  );
}