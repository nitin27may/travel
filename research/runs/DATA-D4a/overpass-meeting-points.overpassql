[out:json][timeout:60];
(
  nwr["name"~"Banff Trail Riders|Warner Stable|Brewster.*Stable|Jasper Riding Stables|Alpine Stables",i](49.0,-118.3,53.0,-114.5);
  nwr["aeroway"="heliport"](50.7,-115.6,51.2,-115.2);
  nwr["name"~"Yoho.*Visitor|Field Visitor",i](51.35,-116.6,51.45,-116.45);
  nwr["name"~"Bow Falls",i](51.15,-115.6,51.17,-115.55);
  nwr["name"~"Fairmont Banff Springs",i](51.15,-115.6,51.17,-115.55);
  nwr["name"~"Norquay|Cliffhouse",i](51.19,-115.63,51.22,-115.58);
  nwr["name"~"Waterton.*Marina|Shoreline Cruise",i](49.03,-113.93,49.07,-113.88);
  nwr["name"~"Icefield|Glacier Discovery|Icewalks",i](52.17,-117.28,52.25,-117.18);
  nwr["name"~"Yamnuska",i](51.0,-115.4,51.12,-115.3);
);
out center tags;
