import {localDate} from './workspace';
export type ActivityPeriod='week'|'month'|'year';
export function periodDates(period:ActivityPeriod,anchor:Date):Date[]{
 const start=new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate(),12);
 let end:Date;
 if(period==='week'){start.setDate(start.getDate()-(start.getDay()+6)%7);end=new Date(start);end.setDate(end.getDate()+6);}
 else if(period==='month'){start.setDate(1);end=new Date(start.getFullYear(),start.getMonth()+1,0,12);}
 else{start.setMonth(0,1);end=new Date(start.getFullYear(),11,31,12);}
 const dates:Date[]=[];for(const date=new Date(start);date<=end;date.setDate(date.getDate()+1))dates.push(new Date(date));return dates;
}
export function shiftPeriod(period:ActivityPeriod,anchor:Date,direction:number):Date{
 const next=new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate(),12);
 if(period==='week')next.setDate(next.getDate()+7*direction);
 else if(period==='month'){next.setDate(1);next.setMonth(next.getMonth()+direction);}
 else{next.setMonth(0,1);next.setFullYear(next.getFullYear()+direction);}
 return next;
}
export function periodTitle(period:ActivityPeriod,anchor:Date):string{
 if(period==='year')return `${anchor.getFullYear()}年`;
 if(period==='month')return `${anchor.getFullYear()}年${anchor.getMonth()+1}月`;
 const dates=periodDates(period,anchor);return `${localDate(dates[0])} — ${localDate(dates[6])}`;
}
