import Image from 'next/image';

export default function Header() {
  return (
    <header style={{ padding: '20px', background: '#e11d48', color: 'white', textAlign: 'center' }}>
      <img src="/logo.png" alt="Logo" style={{ height: '50px', marginBottom: '10px' }} />
      <h1>Võhma Lihakombinaadi ennustusvõistlus, MM 2026</h1>
      <nav>
        <a href="/" style={{ color: 'white', margin: '0 10px' }}>Avaleht</a>
        <a href="/login" style={{ color: 'white', margin: '0 10px' }}>Logi sisse</a>
        <a href="/admin" style={{ color: 'white', margin: '0 10px' }}>Admin</a>
      </nav>
    </header>
  );
}