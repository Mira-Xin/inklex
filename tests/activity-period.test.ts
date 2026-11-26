import {test} from 'node:test';
import assert from 'node:assert/strict';
import {periodDates,periodTitle,shiftPeriod} from '../src/lib/activity-period';
import {localDate} from '../src/lib/workspace';
test('week ranges run Monday to Sunday, including year boundaries',()=>{
 const dates=periodDates('week',new Date(2026,0,1));assert.equal(dates.length,7);assert.equal(localDate(dates[0]),'2025-12-29');assert.equal(localDate(dates[6]),'2026-01-04');assert.equal(periodTitle('week',new Date(2026,0,1)),'2025-12-29 — 2026-01-04');
});
test('month and year ranges include exactly their calendar days, including leap days',()=>{
 assert.equal(periodDates('month',new Date(2024,1,20)).length,29);assert.equal(periodDates('month',new Date(2026,1,20)).length,28);
 const year=periodDates('year',new Date(2026,10,26));assert.equal(year.length,365);assert.equal(localDate(year[0]),'2026-01-01');assert.equal(localDate(year.at(-1)!),'2026-12-31');assert.equal(periodDates('year',new Date(2024,0,1)).length,366);
});
test('navigation does not skip short months or retain a leap-day overflow',()=>{
 assert.equal(localDate(shiftPeriod('month',new Date(2026,0,31),1)),'2026-02-01');assert.equal(localDate(shiftPeriod('month',new Date(2026,0,31),-1)),'2025-12-01');assert.equal(localDate(shiftPeriod('year',new Date(2024,1,29),1)),'2025-01-01');assert.equal(localDate(shiftPeriod('week',new Date(2026,0,1),1)),'2026-01-08');
});
