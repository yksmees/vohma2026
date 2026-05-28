import Header from '../components/Header';

export default function Home() {
  return (
    <div>
      <Header />
      <main style={{ padding: '20px' }}>
        <h2>Tere tulemast ennustusvõistlusele!</h2>
        <p>Logi sisse, et alustada ennustamist.</p>
      </main>
    </div>
  );
}