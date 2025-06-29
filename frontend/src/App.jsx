import { useEffect, useState } from "react";
import { ethers } from "ethers";
import SplitBill from "./SplitBill.json";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export default function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");

  const [name, setName] = useState("");
  const [wallet, setWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [people, setPeople] = useState([]);

  const [bills, setBills] = useState([]);
  const [settlements, setSettlements] = useState([]);

  useEffect(() => {
    async function init() {
      if (!window.ethereum) return alert("MetaMask not found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, SplitBill.abi, signer);

      setAccount(address);
      setContract(contract);
    }
    init();
  }, []);

  const addPerson = () => {
    if (!name || !wallet || !amount) return alert("Fill all fields");
    setPeople([...people, { name, wallet, amount }]);
    setName(""); setWallet(""); setAmount("");
  };

  const createBill = async () => {
    if (!contract || people.length < 2) return alert("Add at least 2 participants");
    try {
      const names = people.map(p => p.name);
      const wallets = people.map(p => ethers.getAddress(p.wallet.trim()));
      const amounts = people.map(p => ethers.parseEther(p.amount));

      const tx = await contract.createBill(names, wallets, amounts);
      await tx.wait();

      alert("Bill created!");
      setPeople([]);
      fetchBills();
      fetchSettlements();
    } catch (err) {
      console.error(err);
      alert("Transaction failed");
    }
  };

  const fetchBills = async () => {
    if (!contract) return;
    try {
      const count = await contract.getBillCount();
      const all = [];

      for (let i = 0; i < Number(count); i++) {
        const [names, wallets, amounts, paidFlags, total, timestamp] = await contract.getBill(i);
        all.push({
          index: i,
          names,
          wallets,
          amounts: amounts.map(a => ethers.formatEther(a)),
          paid: paidFlags,
          total: ethers.formatEther(total),
          timestamp: new Date(Number(timestamp) * 1000).toLocaleString()
        });
      }

      setBills(all);
    } catch (err) {
      console.error("Bill fetch error", err);
    }
  };

  const pay = async (billIndex, amountETH) => {
    if (!contract) return;
    try {
      const tx = await contract.payShare(billIndex, {
        value: ethers.parseEther(amountETH)
      });
      await tx.wait();
      alert("Payment successful");
      fetchBills();
    } catch (err) {
      console.error("Payment error", err);
      alert("Transaction failed");
    }
  };

  const fetchSettlements = async () => {
    if (!contract) return;
    try {
      const count = await contract.getBillCount();
      if (Number(count) === 0) return;
      const billIndex = Number(count) - 1;

      const [names, wallets] = await contract.getBill(billIndex);
      const nameMap = {};
      for (let i = 0; i < names.length; i++) {
        nameMap[wallets[i].toLowerCase()] = names[i];
      }

      const [froms, tos, amounts] = await contract.calculateSettlements(billIndex);
      const parsed = froms.map((from, i) => ({
        from: nameMap[from.toLowerCase()] || from,
        to: nameMap[tos[i].toLowerCase()] || tos[i],
        amount: ethers.formatEther(amounts[i])
      }));

      setSettlements(parsed);
    } catch (err) {
      console.error("Settlement fetch error", err);
    }
  };

  useEffect(() => {
    if (contract) {
      fetchBills();
      fetchSettlements();
    }
  }, [contract]);

  return (
    <div className="min-h-screen p-6 bg-gray-100 text-sm">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-2">💸 Split Bill DApp</h1>
        <p className="mb-4 text-gray-600">Connected as: {account}</p>

        {/* Add Person */}
        <div className="flex gap-2 mb-4">
          <input className="border p-2 w-32" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input className="border p-2 flex-1" placeholder="Wallet" value={wallet} onChange={e => setWallet(e.target.value)} />
          <input className="border p-2 w-24" placeholder="ETH" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={addPerson}>+ Add</button>
        </div>

        {/* People Table */}
        {people.length > 0 && (
          <table className="w-full mb-4 text-sm">
            <thead><tr><th>Name</th><th>Wallet</th><th>Amount</th></tr></thead>
            <tbody>
              {people.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td className="text-xs">{p.wallet}</td>
                  <td>{p.amount} ETH</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={createBill}>✅ Create Bill</button>

        {/* Bill History */}
        <h2 className="text-xl font-semibold mt-8 mb-2">📜 Bill History</h2>
        {bills.length === 0 ? (
          <p className="text-gray-500">No bills yet.</p>
        ) : (
          bills.map((bill, i) => (
            <div key={i} className="bg-gray-50 border p-4 mb-4 rounded">
              <p><strong>Created on:</strong> {bill.timestamp}</p>
              <p><strong>Total:</strong> {bill.total} ETH</p>
              <table className="w-full mt-2 mb-2 text-sm">
                <thead><tr><th>Name</th><th>Wallet</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {bill.names.map((n, j) => (
                    <tr key={j}>
                      <td>{n}</td>
                      <td className="text-xs">{bill.wallets[j]}</td>
                      <td>{bill.amounts[j]} ETH</td>
                      <td>
                        {bill.paid[j] ? (
                          <span className="text-green-600">Paid ✅</span>
                        ) : (
                          bill.wallets[j].toLowerCase() === account.toLowerCase() ? (
                            <button
                              className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                              onClick={() => pay(bill.index, bill.amounts[j])}
                            >
                              Pay
                            </button>
                          ) : (
                            <span className="text-red-500">Unpaid</span>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        {/* Settlement Summary */}
        <h2 className="text-xl font-semibold mt-8 mb-2">📊 Settlement Summary</h2>
        {settlements.length === 0 ? (
          <p className="text-gray-500">No settlements yet.</p>
        ) : (
          <ul className="list-disc ml-5">
            {settlements.map((s, i) => (
              <li key={i}>
                <strong>{s.from}</strong> owes <strong>{s.to}</strong>{" "}
                <span className="text-green-600">{s.amount} ETH</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
