import React, { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';

// Utility to get weekdays for a given month/year, excluding bank holidays
function getWeekdays(year, monthIndex, bankHolidays) {
  const dates = [];
  let cursor = new Date(year, monthIndex, 1);
  while (cursor.getMonth() === monthIndex) {
    const dow = cursor.getDay();
    const key = format(cursor, 'yyyy-MM-dd');
    if (dow >= 1 && dow <= 5 && !bankHolidays.includes(key)) {
      dates.push(new Date(cursor));
    }
    cursor = addDays(cursor, 1);
  }
  return dates;
}

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default function RotaGenerator() {
  const [employees, setEmployees] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const defaultHolidaysURL = 'https://www.gov.uk/bank-holidays.json';
  const [bankHolidayUrl] = useState(defaultHolidaysURL);
  const [bankHolidays, setBankHolidays] = useState([]);
  const [unavail, setUnavail] = useState({});
  const [editingEmp, setEditingEmp] = useState(null);
  const [tempAvail, setTempAvail] = useState({ weekdays: [], ranges: [], _rangeStart: '', _rangeEnd: '' });
  const [error, setError] = useState('');
  const [rota, setRota] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayError, setHolidayError] = useState('');

  // Add handleKeyPress function
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addEmployee();
    }
  };

  // Fetch UK bank holidays once
  useEffect(() => {
    setLoadingHolidays(true);
    fetch(bankHolidayUrl)
      .then(res => res.json())
      .then(data => {
        const dates = [];
        if (data['england-and-wales']?.events) {
          data['england-and-wales'].events.forEach(e => dates.push(e.date));
        }
        setBankHolidays(dates);
        setHolidayError('');
      })
      .catch(() => setHolidayError('Failed to load bank holidays'))
      .finally(() => setLoadingHolidays(false));
  }, [bankHolidayUrl]);

  const addEmployee = () => {
    if (!nameInput.trim()) return;
    setEmployees(prev => [...prev, nameInput.trim()]);
    setNameInput('');
  };

  const removeEmployee = emp => {
    setEmployees(prev => prev.filter(e => e !== emp));
    setUnavail(prev => { const copy = { ...prev }; delete copy[emp]; return copy; });
  };

  const startEdit = emp => {
    if (editingEmp === emp) { setEditingEmp(null); setError(''); }
    else {
      const existing = unavail[emp] || { weekdays: [], ranges: [] };
      setTempAvail({ ...existing, _rangeStart: '', _rangeEnd: '' });
      setEditingEmp(emp);
      setError('');
    }
  };

  const saveEdit = () => {
    setUnavail(prev => ({ ...prev, [editingEmp]: { weekdays: tempAvail.weekdays, ranges: tempAvail.ranges } }));
    setEditingEmp(null);
    setError('');
  };

  const toggleWeekday = day => {
    setTempAvail(prev => {
      const list = prev.weekdays.includes(day)
        ? prev.weekdays.filter(d => d !== day)
        : [...prev.weekdays, day];
      return { ...prev, weekdays: list };
    });
  };

  const addRange = () => {
    const { _rangeStart: start, _rangeEnd: end, ranges } = tempAvail;
    if (!start || !end || start > end) { setError('Invalid date range'); return; }
    if (ranges.some(r => r.start === start && r.end === end)) { setError('Range already selected'); return; }
    setTempAvail(prev => ({ ...prev, ranges: [...prev.ranges, { start, end }], _rangeStart: '', _rangeEnd: '' }));
    setError('');
  };

  const deleteRange = idx => setTempAvail(prev => ({ ...prev, ranges: prev.ranges.filter((_, i) => i !== idx) }));
  const clearTemp = () => { setTempAvail({ weekdays: [], ranges: [], _rangeStart: '', _rangeEnd: '' }); setError(''); };

  const generateRota = () => {
    const dates = getWeekdays(year, month, bankHolidays);
    const assignments = {};
    const assigned = {};
    const result = [];
    const order = [...employees].sort(() => Math.random() - 0.5);
    order.forEach(e => assignments[e] = 0);

    const canAssign = (emp, d, prevEmp) => {
      const dow = d.getDay();
      const key = format(d, 'yyyy-MM-dd');
      const off = unavail[emp] || { weekdays: [], ranges: [] };
      if (off.weekdays.includes(dow)) return false;
      if (off.ranges.some(r => key >= r.start && key <= r.end)) return false;
      if (assignments[emp] >= 3) return false;
      if (emp === prevEmp) return false;
      return true;
    };

    order.forEach(emp => {
      for (const d of dates) {
        const k = format(d, 'yyyy-MM-dd');
        const p = format(addDays(d, -1), 'yyyy-MM-dd');
        if (!assigned[k] && canAssign(emp, d, assigned[p])) { assigned[k] = emp; assignments[emp]++; break; }
      }
    });

    dates.forEach(d => {
      const k = format(d, 'yyyy-MM-dd');
      if (!assigned[k]) {
        const p = format(addDays(d, -1), 'yyyy-MM-dd');
        const prev = assigned[p];
        const eligible = order.filter(emp => canAssign(emp, d, prev));
        const pick = eligible.length ? eligible[Math.floor(Math.random() * eligible.length)] : order.find(emp => canAssign(emp, d, null));
        assigned[k] = pick; if (pick) assignments[pick]++;
      }
      result.push({ date: format(d, 'dd/MM/yyyy'), emp: assigned[k] || '-' });
    });

    setRota(result);
  };

  const clearRota = () => setRota([]);

  const exportCSV = () => {
    const header = 'Date,Assigned Person\n';
    const rows = rota.map(r => `${r.date},${r.emp}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `rota_${monthNames[month]}_${year}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-full font-space-mono bg-cyber-black text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center tracking-wider border-b border-white pb-4">
          Monthly Rota Generator
        </h1>

        {/* Employee input */}
        <div className="mb-8 flex space-x-4">
          <input 
            className="flex-grow p-3 rounded-lg bg-cyber-gray border border-white text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyber-purple" 
            placeholder="Employee name" 
            value={nameInput} 
            onChange={e => setNameInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button 
            className="px-6 py-3 rounded-lg bg-cyber-purple text-white font-bold hover:bg-opacity-80 transition-all duration-300 transform hover:scale-105" 
            onClick={addEmployee}
          >
            Add Employee
          </button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-white">Year:</label>
            <input 
              type="number" 
              value={year} 
              onChange={e => setYear(+e.target.value)} 
              className="w-full p-3 rounded-lg bg-cyber-gray border border-white text-white focus:outline-none focus:ring-2 focus:ring-cyber-purple" 
            />
          </div>
          <div>
            <label className="block mb-2 text-white">Month:</label>
            <select 
              value={month} 
              onChange={e => setMonth(+e.target.value)} 
              className="w-full p-3 pr-8 rounded-lg bg-cyber-gray border border-white text-white focus:outline-none focus:ring-2 focus:ring-cyber-purple appearance-none bg-no-repeat bg-[length:12px_12px] bg-[right_12px_center]"
            >
              {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4 text-white">Employees & Unavailability</h2>
        <ul className="space-y-4 mb-8">
          {employees.map(emp => {
            const info = unavail[emp] || { weekdays: [], ranges: [] };
            return (
              <li key={emp} className="p-4 rounded-lg bg-cyber-gray border border-white flex justify-between items-center">
                <div>
                  <span className="font-bold text-white">{emp}</span>
                  {info.weekdays.length || info.ranges.length ? (
                    <div className="text-sm text-white/70">
                      Unavailable: {' '}
                      {info.weekdays.map(d => ['Mon','Tue','Wed','Thu','Fri'][d-1]).join(', ')}
                      {info.ranges.map((r,i) => <span key={i} className="ml-1">{r.start} to {r.end}</span>)}
                    </div>
                  ) : (<div className="text-sm text-white/50">No blocks</div>)}
                </div>
                <div className="flex space-x-4">
                  <button 
                    className="text-sm text-white hover:text-cyber-purple transition-colors duration-300" 
                    onClick={() => startEdit(emp)}
                  >
                    {editingEmp === emp ? 'Cancel' : 'Edit'}
                  </button>
                  <button 
                    className="text-sm text-cyber-pink hover:text-cyber-purple transition-colors duration-300" 
                    onClick={() => removeEmployee(emp)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {editingEmp && (
          <div className="p-6 mb-8 rounded-lg bg-cyber-gray border border-white">
            <h3 className="text-xl font-bold mb-4 text-white">Edit Availability: {editingEmp}</h3>
            {error && <div className="text-cyber-pink mb-4">{error}</div>}
            <div className="mb-4">
              <span className="text-white">Weekdays:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {[1,2,3,4,5].map(d => (
                  <button 
                    key={d} 
                    onClick={() => toggleWeekday(d)} 
                    className={`px-4 py-2 rounded-lg border transition-all duration-300 ${
                      tempAvail.weekdays.includes(d) 
                        ? 'bg-cyber-purple text-white border-cyber-purple' 
                        : 'border-white text-white hover:bg-white/10'
                    }`}
                  >
                    {['Mon','Tue','Wed','Thu','Fri'][d-1]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-white mb-2">Add Date Range:</label>
              <div className="flex flex-wrap gap-4">
                <input 
                  type="date" 
                  value={tempAvail._rangeStart} 
                  onChange={e => setTempAvail(prev => ({ ...prev, _rangeStart: e.target.value }))} 
                  className="p-3 rounded-lg bg-cyber-gray border border-white text-white focus:outline-none focus:ring-2 focus:ring-cyber-purple" 
                />
                <input 
                  type="date" 
                  value={tempAvail._rangeEnd} 
                  onChange={e => setTempAvail(prev => ({ ...prev, _rangeEnd: e.target.value }))} 
                  className="p-3 rounded-lg bg-cyber-gray border border-white text-white focus:outline-none focus:ring-2 focus:ring-cyber-purple" 
                />
                <button 
                  className="px-4 py-3 rounded-lg bg-cyber-purple text-white font-bold hover:bg-opacity-80 transition-all duration-300" 
                  onClick={addRange}
                >
                  Add Range
                </button>
                <button 
                  className="px-4 py-3 rounded-lg border border-white text-white hover:bg-white/10 transition-all duration-300" 
                  onClick={clearTemp}
                >
                  Clear Ranges
                </button>
              </div>
            </div>
            <div className="mb-4">
              {tempAvail.ranges.map((r, idx) => (
                <div key={idx} className="flex items-center text-sm mb-2 text-white">
                  <span>{r.start} to {r.end}</span>
                  <button 
                    className="ml-4 text-cyber-pink hover:text-cyber-purple transition-colors duration-300" 
                    onClick={() => deleteRange(idx)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <button 
              className="px-6 py-3 rounded-lg bg-cyber-purple text-white font-bold hover:bg-opacity-80 transition-all duration-300" 
              onClick={saveEdit}
            >
              Save
            </button>
          </div>
        )}

        <div className="flex space-x-4 mb-8">
          <button 
            className="px-6 py-3 rounded-lg bg-cyber-purple text-white font-bold hover:bg-opacity-80 transition-all duration-300 transform hover:scale-105" 
            onClick={generateRota}
          >
            Generate Rota
          </button>
          {rota.length > 0 && (
            <button 
              className="px-6 py-3 rounded-lg border border-white text-white hover:bg-white/10 transition-all duration-300" 
              onClick={clearRota}
            >
              Clear Rota
            </button>
          )}
        </div>

        {rota.length > 0 && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-cyber-gray">
                    <th className="p-4 text-left border-b border-white text-white">Date</th>
                    <th className="p-4 text-left border-b border-white text-white">Assigned Person</th>
                  </tr>
                </thead>
                <tbody>
                  {rota.map((r,i) => (
                    <tr key={i} className="border-b border-white/30">
                      <td className="p-4 text-white">{r.date}</td>
                      <td className="p-4 text-white">{r.emp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button 
              className="px-6 py-3 rounded-lg bg-cyber-purple text-white font-bold hover:bg-opacity-80 transition-all duration-300 transform hover:scale-105" 
              onClick={exportCSV}
            >
              Export CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
