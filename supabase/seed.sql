-- Development only seed. Do not run in production.
insert into households(id,name) values('00000000-0000-0000-0000-000000000001','Foyer démonstration');
insert into activities(household_id,code,name,type,active,display_order) values('00000000-0000-0000-0000-000000000001','IPTV','Vente IPTV','service',true,1),('00000000-0000-0000-0000-000000000001','MINI_UPS','Vente Mini UPS','retail',true,2),('00000000-0000-0000-0000-000000000001','ANDROID_TV_BOX','Vente Android TV Box','retail',true,3),('00000000-0000-0000-0000-000000000001','BILLIARD','Table de billard','venue',false,4);
