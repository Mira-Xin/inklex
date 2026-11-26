import {useState} from 'react';
import {aggregateActivity,localDate,type Activity} from '../lib/workspace';
import {periodDates,periodTitle,shiftPeriod,type ActivityPeriod} from '../lib/activity-period';
const weekDays=['一','二','三','四','五','六','日'];
const periodNames={week:'周',month:'月',year:'年'};
export default function ActivityMap({activity}:{activity:Activity[]}){
 const [kind,setKind]=useState<Activity['kind']>('practice'),[metric,setMetric]=useState<'count'|'minutes'>('count');
 const [period,setPeriod]=useState<ActivityPeriod>('year'),[anchor,setAnchor]=useState(()=>new Date());
 const totals=aggregateActivity(activity,kind,kind==='practice'?metric:'count'),dates=periodDates(period,anchor);
 const amounts=dates.map(date=>totals.get(localDate(date))||0),max=Math.max(1,...amounts),total=amounts.reduce((a,b)=>a+b,0),unit=kind==='practice'&&metric==='minutes'?'分钟':'条';
 const offset=(dates[0].getDay()+6)%7,title=periodTitle(period,anchor);
 const monthMarkers=period==='year'?dates.filter(date=>date.getDate()===1).map(date=>({name:`${date.getMonth()+1}月`,column:Math.floor((dates.findIndex(item=>localDate(item)===localDate(date))+offset)/7)+1})):[];
 return <section className="activity-map" aria-label="每日积累热力图">
  <div className="activity-head"><h3>日常积累</h3>
   <div className="choice-buttons" role="group" aria-label="活动类型">{([{id:'practice',name:'练习'},{id:'input',name:'输入'},{id:'output',name:'输出'}] as const).map(item=><button key={item.id} aria-pressed={kind===item.id} className={kind===item.id?'selected':''} onClick={()=>setKind(item.id)}>{item.name}</button>)}</div>
   {kind==='practice'&&<div className="choice-buttons" role="group" aria-label="练习统计单位"><button aria-pressed={metric==='count'} className={metric==='count'?'selected':''} onClick={()=>setMetric('count')}>条数</button><button aria-pressed={metric==='minutes'} className={metric==='minutes'?'selected':''} onClick={()=>setMetric('minutes')}>分钟</button></div>}
   <div className="choice-buttons period-options" role="group" aria-label="热力图展示周期">{(['week','month','year'] as const).map(value=><button key={value} aria-pressed={period===value} className={period===value?'selected':''} onClick={()=>setPeriod(value)}>{periodNames[value]}</button>)}</div>
  </div>
  <div className="activity-period-bar"><p className="muted">{kind==='practice'?'素材库练习记录':kind==='input'?'每天新增的语料':'复习中完成回忆的语料'} · 所选{periodNames[period]} {Number(total.toFixed(1))} {unit}</p>
   <nav className="activity-period-navigation" aria-label="切换统计日期"><button onClick={()=>setAnchor(value=>shiftPeriod(period,value,-1))}>上一{periodNames[period]}</button><strong role="status">{title}</strong><button onClick={()=>setAnchor(value=>shiftPeriod(period,value,1))}>下一{periodNames[period]}</button><button onClick={()=>setAnchor(new Date())}>本{periodNames[period]}</button></nav>
  </div>
  <div className={'heatmap-scroll heatmap-'+period}>
   {period!=='year'&&<div className="heatmap-weekdays" aria-hidden="true">{weekDays.map(day=><span key={day}>周{day}</span>)}</div>}
   {period==='year'&&<div className="heatmap-year-months" aria-hidden="true">{monthMarkers.map(item=><span key={item.name} style={{gridColumn:item.column}}>{item.name}</span>)}</div>}
   <div className={'heatmap-grid period-'+period} role="list" aria-label="每日活动记录">
    {Array.from({length:offset},(_,index)=><span key={'empty-'+index} className="heatmap-empty" aria-hidden="true"/>)}
    {dates.map((date,index)=>{const key=localDate(date),value=amounts[index],level=value===0?0:Math.min(4,Math.max(1,Math.ceil(value/max*4)));return <span role="listitem" tabIndex={period!=='year'||value?0:undefined} className={'heatmap-day level-'+level} key={key} title={`${key}：${Number(value.toFixed(1))}${unit}`} aria-label={`${key}：${Number(value.toFixed(1))}${unit}`}>
     {period!=='year'&&<><span className="heatmap-date">{period==='week'?`${date.getMonth()+1}/${date.getDate()}`:date.getDate()}</span>{value>0&&<small>{Number(value.toFixed(1))}{unit}</small>}</>}
    </span>;})}
   </div>
  </div>
  <div className="heatmap-legend"><span>{localDate(dates[0])} — {localDate(dates[dates.length-1])}</span><span>少 {[0,1,2,3,4].map(level=><i className={'heatmap-day level-'+level} key={level}/>)} 多</span></div>
  <small className="muted">旧数据不补算。</small>
 </section>;
}
