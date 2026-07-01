begin;

delete from leads
where lead_no = 'ANON-CHECK-1780813094965'
  and email = 'anon-check-1780813094965@example.test';

delete from website_visits
where session_id = 'session-anon-check-1780813094965'
  and visitor_id = 'visitor-anon-check-1780813094965';

commit;
