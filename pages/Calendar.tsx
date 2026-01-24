
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Customer, CustomerStatus, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Phone, User, Clock, 
  MapPin, CheckCircle2, Flame, AlertCircle, Ban, CalendarDays, MessageCircle
} from 'lucide-react';

const CalendarPage: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchCustomers();
  }, [userProfile]);

  const fetchCustomers = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
        let teamIds: string[] = [];
        
        // --- ISOLATION LOGIC (Same as Dashboard) ---
        if (isAdmin) {
            // Admin sees all (or filtered later if needed, but for calendar generally helpful to see all tasks)
            const { data: profiles } = await supabase.from('profiles').select('id');
            teamIds = profiles?.map(p => p.id) || [];
        } else if (isMod) {
            // MOD: See Self + Subordinates
            const { data: profiles } = await supabase.from('profiles').select('id').or(`id.eq.${userProfile.id},manager_id.eq.${userProfile.id}`);
            teamIds = profiles?.map(p => p.id) || [];
        } else {
            // Sales: Self only
            teamIds = [userProfile.id];
        }

        // Fetch active customers with a recare_date
        let query = supabase
            .from('customers')
            .select('id, name, phone, status, recare_date, interest, classification, sales_rep, creator_id, created_at')
            .not('recare_date', 'is', null) // Only fetch if they have a task
            .neq('status', CustomerStatus.LOST) // Ignore Lost for calendar? Maybe include if pending lost.
            .neq('status', CustomerStatus.WON); // Ignore Won for calendar tasks usually

        if (!isAdmin) {
            if (teamIds.length > 0) query = query.in('creator_id', teamIds);
            else query = query.eq('creator_id', userProfile.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        setCustomers(data as Customer[]);

    } catch (e) {
        console.error("Error fetching calendar data", e);
    } finally {
        setLoading(false);
    }
  };

  // --- CALENDAR LOGIC ---
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 = Sun

  const generateCalendarGrid = () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const days = daysInMonth(year, month);
      const startDay = firstDayOfMonth(year, month); // 0 (Sun) to 6 (Sat)
      
      // Adjust for Monday start if preferred (Vietnamese usually like Mon start)
      // Standard Date.getDay(): Sun=0, Mon=1...
      // Let's stick to Sun start for standard view or Mon start. 
      // Let's do Mon start: Mon=0 ... Sun=6.
      const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

      const grid = [];
      let day = 1;

      // 6 rows max to cover all months
      for (let i = 0; i < 6; i++) {
          const row = [];
          for (let j = 0; j < 7; j++) {
              if (i === 0 && j < adjustedStartDay) {
                  row.push(null);
              } else if (day > days) {
                  row.push(null);
              } else {
                  row.push(day);
                  day++;
              }
          }
          grid.push(row);
          if (day > days) break;
      }
      return grid;
  };

  const getTasksForDate = (day: number) => {
      if (!day) return [];
      const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 12).toISOString().split('T')[0]; // Safe noon time
      return customers.filter(c => c.recare_date === dateStr);
  };

  const getTasksForSelectedDate = () => {
      return customers.filter(c => c.recare_date === selectedDateStr);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const handlePrevMonth = () => {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number) => {
      // Construct date string manually to avoid timezone issues
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const d = day.toString().padStart(2, '0');
      const str = `${currentDate.getFullYear()}-${month}-${d}`;
      setSelectedDateStr(str);
  };

  const grid = generateCalendarGrid();
  const selectedTasks = getTasksForSelectedDate();
  
  // Format Date for Display
  const selectedDateDisplay = new Date(selectedDateStr).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6">
      
      {/* LEFT: CALENDAR */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          {/* Calendar Header */}
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-800 capitalize">
                      Tháng {currentDate.getMonth() + 1}, {currentDate.getFullYear()}
                  </h2>
                  <button onClick={() => { setCurrentDate(new Date()); setSelectedDateStr(todayStr); }} className="text-xs font-bold bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">Hôm nay</button>
              </div>
              <div className="flex gap-1">
                  <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
                  <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight size={20}/></button>
              </div>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                  <div key={d} className="py-2 text-center text-xs font-bold text-gray-500 uppercase">{d}</div>
              ))}
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 grid grid-rows-6">
              {grid.map((row, i) => (
                  <div key={i} className="grid grid-cols-7 h-full border-b border-gray-100 last:border-0">
                      {row.map((day, j) => {
                          if (!day) return <div key={j} className="bg-gray-50/30 border-r border-gray-100 last:border-0"></div>;
                          
                          // Check Date Logic
                          const cellDateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth()+1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                          const isSelected = cellDateStr === selectedDateStr;
                          const isToday = cellDateStr === todayStr;
                          const tasks = getTasksForDate(day);
                          
                          // Dot Logic
                          const overdueCount = tasks.filter(t => t.recare_date && t.recare_date < todayStr).length;
                          const todayCount = tasks.filter(t => t.recare_date === todayStr).length;
                          const futureCount = tasks.filter(t => t.recare_date && t.recare_date > todayStr).length;

                          return (
                              <div 
                                  key={j} 
                                  onClick={() => handleDayClick(day)}
                                  className={`relative border-r border-gray-100 last:border-0 p-2 cursor-pointer transition-colors hover:bg-blue-50
                                      ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-200' : ''}
                                      ${isToday ? 'bg-yellow-50' : ''}
                                  `}
                              >
                                  <span className={`text-sm font-medium inline-flex w-7 h-7 items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}`}>{day}</span>
                                  
                                  {/* Dots Container */}
                                  <div className="flex gap-1 mt-1 flex-wrap content-start h-full">
                                      {overdueCount > 0 && <span className="h-2 w-2 rounded-full bg-red-500" title={`${overdueCount} quá hạn`}></span>}
                                      {todayCount > 0 && <span className="h-2 w-2 rounded-full bg-orange-500" title={`${todayCount} hôm nay`}></span>}
                                      {futureCount > 0 && <span className="h-2 w-2 rounded-full bg-blue-400" title={`${futureCount} sắp tới`}></span>}
                                      
                                      {/* Count Label if many */}
                                      {tasks.length > 3 && <span className="text-[9px] text-gray-400">+{tasks.length - 3}</span>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              ))}
          </div>
      </div>

      {/* RIGHT: TASK LIST */}
      <div className="w-full md:w-96 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><CalendarDays size={18} className="text-blue-600"/> Lịch hẹn</h3>
                  <p className="text-xs text-gray-500 font-medium capitalize">{selectedDateDisplay}</p>
              </div>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">{selectedTasks.length} việc</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400"/></div>
              ) : selectedTasks.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={32} className="text-gray-300"/></div>
                      <p>Không có lịch hẹn nào.</p>
                  </div>
              ) : (
                  selectedTasks.map(task => {
                      const isOverdue = task.recare_date && task.recare_date < todayStr;
                      const zaloLink = `https://zalo.me/${task.phone.replace(/\D/g, '')}`;
                      
                      return (
                          <div key={task.id} onClick={() => navigate(`/customers/${task.id}`)} className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md group ${isOverdue ? 'border-red-200 bg-red-50 hover:bg-red-100' : 'border-gray-100 bg-white hover:border-blue-200'}`}>
                              <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                      {task.classification === 'Hot' && <Flame size={14} className="text-red-500 fill-red-500 animate-pulse"/>}
                                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-700">{task.name}</h4>
                                  </div>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${task.status === 'Mới' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{task.status}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                                  <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100"><Phone size={10}/> {task.phone}</span>
                                  {task.interest && <span className="font-bold text-gray-700">{task.interest}</span>}
                              </div>
                              <div className="flex gap-2">
                                  <a href={`tel:${task.phone}`} onClick={(e) => e.stopPropagation()} className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-green-700 shadow-sm"><Phone size={12}/> Gọi</a>
                                  <a href={zaloLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-700 shadow-sm"><MessageCircle size={12}/> Zalo</a>
                                  <button className="flex-1 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50">Chi tiết</button>
                              </div>
                          </div>
                      );
                  })
              )}
          </div>
      </div>
    </div>
  );
};

export default CalendarPage;

