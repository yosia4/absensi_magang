import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import InternDashboard from "../src/components/InternDashboard";
import AttendanceReports from "../src/components/AttendanceReports";
import AttendanceTrend from "../src/components/AttendanceTrend";
import AttendanceTable from "../src/components/AttendanceTable";
import { jakartaToday, shiftDate } from "../src/attendanceVisuals";
import "../src/styles.css";
const today=jakartaToday();
const person={id:'a',name:'Peserta Uji',initials:'PU',is_active:true,internship_start:today.slice(0,7)+'-01',internship_end:null,role:'intern',university:'Universitas Uji',major:'Informatika'};
const records=[['Izin',1],['Sakit',2],['Alpa',3]].map(([status,days])=>({user_id:'a',date:shiftDate(today,-days),status,check_in:null,check_out:null}));
window.fail=false;
const client={from(table){let offset=0,end=500;let filters=[];let signal;return {select(){return this},eq(k,v){filters.push(r=>r[k]===v);return this},in(k,v){filters.push(r=>v.includes(r[k]));return this},gte(k,v){filters.push(r=>r[k]>=v);return this},lte(k,v){filters.push(r=>r[k]<=v);return this},order(){return this},range(a,b){offset=a;end=b+1;return this},abortSignal(v){signal=v;return this},then(resolve){return new Promise(r=>setTimeout(r,350)).then(()=>resolve(window.fail||signal?.aborted?{data:null,error:new Error('Offline')}:{data:(table==='profiles'?[person]:table==='attendance'?records:[]).filter(r=>filters.every(f=>f(r))).slice(offset,end),error:null}))}}},channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){}};
function Fixture(){const [status,setStatus]=useState('Izin');const record=status==='Belum Absen'?null:{date:today,status:status==='Selesai'?'Hadir':status,check_in:['Hadir','Terlambat','Selesai'].includes(status)?'08:00':null,check_out:status==='Selesai'?'16:00':null};return <div style={{maxWidth:1050,margin:'24px auto',padding:'0 16px'}}><div id="switches">{['Izin','Sakit','Alpa','Hadir','Terlambat','Selesai','Belum Absen'].map(x=><button key={x} onClick={()=>setStatus(x)}>{x}</button>)}</div><div id="dashboard"><InternDashboard user={person} record={record} attendance={record?[record]:[]} nav={()=>{}} /></div><div id="reports"><AttendanceReports client={client} flash={(m)=>window.lastMessage=m}/></div><AttendanceTrend client={client}/><section className="panel"><AttendanceTable rows={[]} loading/></section></div>}
createRoot(document.getElementById('root')).render(<Fixture/>);
