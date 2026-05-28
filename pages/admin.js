import Header from '../components/Header';
import Papa from 'papaparse';

export default function Admin() {
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        console.log("Importitud andmed:", results.data);
        alert("Fail loetud! Vaata konsooli.");
      }
    });
  };

  return (
    <div>
      <Header />
      <main style={{ padding: '20px' }}>
        <h2>Admin paneel</h2>
        <input type="file" onChange={handleFileUpload} />
      </main>
    </div>
  );
}