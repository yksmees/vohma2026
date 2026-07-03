import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import WebSocket from "ws";
// Railway kasutab Node 20. Supabase Realtime vajab selles keskkonnas ws transporti.
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}


function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : "";
}

function getSupabaseUrl() {
  const raw = requiredEnv("SUPABASE_URL");
  return raw.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/g, "");
}

function getSupabaseKey() {
  return requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function getJwtSecret() {
  return requiredEnv("JWT_SECRET");
}

function validateRequiredEnv() {
  const errors = [];

  const supabaseUrl = optionalEnv("SUPABASE_URL");
  const supabaseKey = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");
  const jwtSecret = optionalEnv("JWT_SECRET");

  if (!supabaseUrl) errors.push("SUPABASE_URL puudub.");
  if (!supabaseKey) errors.push("SUPABASE_SERVICE_ROLE_KEY puudub.");
  if (!jwtSecret) {
    errors.push("JWT_SECRET puudub.");
  } else {
    if (jwtSecret.length < 16) {
      errors.push("JWT_SECRET on liiga lühike. Kasuta vähemalt 16 juhuslikku märki.");
    }
    if (jwtSecret === "samsung-mm-2026-secret") {
      errors.push("JWT_SECRET on vana avalik vaikeväärtus. Vaheta see Railway Variables all ära.");
    }
  }

  if (errors.length) {
    throw new Error("Kriitilised env muutujad puuduvad või on valed:\n" + errors.map(e => `- ${e}`).join("\n"));
  }

  getSupabaseUrl();
  getSupabaseKey();
  getJwtSecret();
}


const SEED_MATCHES = [{"stage": "Group A", "match_no": 1, "kickoff_utc": "2026-06-11T19:00:00Z", "home": "Mexico", "away": "South Africa", "location": "Estadio Azteca, Mexico City"}, {"stage": "Group A", "match_no": 2, "kickoff_utc": "2026-06-12T02:00:00Z", "home": "South Korea", "away": "Czechia", "location": "Estadio Akron, Zapopan"}, {"stage": "Group B", "match_no": 3, "kickoff_utc": "2026-06-12T19:00:00Z", "home": "Canada", "away": "Bosnia and Herzegovina", "location": "BMO Field, Toronto"}, {"stage": "Group D", "match_no": 4, "kickoff_utc": "2026-06-13T01:00:00Z", "home": "United States", "away": "Paraguay", "location": "SoFi Stadium, Inglewood"}, {"stage": "Group C", "match_no": 5, "kickoff_utc": "2026-06-14T01:00:00Z", "home": "Haiti", "away": "Scotland", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group D", "match_no": 6, "kickoff_utc": "2026-06-14T03:59:00Z", "home": "Australia", "away": "Türkiye", "location": "BC Place, Vancouver"}, {"stage": "Group C", "match_no": 7, "kickoff_utc": "2026-06-13T22:00:00Z", "home": "Brazil", "away": "Morocco", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group B", "match_no": 8, "kickoff_utc": "2026-06-13T19:00:00Z", "home": "Qatar", "away": "Switzerland", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group E", "match_no": 9, "kickoff_utc": "2026-06-14T23:00:00Z", "home": "Ivory Coast", "away": "Ecuador", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group E", "match_no": 10, "kickoff_utc": "2026-06-14T17:00:00Z", "home": "Germany", "away": "Curacao", "location": "NRG Stadium, Houston"}, {"stage": "Group F", "match_no": 11, "kickoff_utc": "2026-06-14T20:00:00Z", "home": "Netherlands", "away": "Japan", "location": "AT&T Stadium, Arlington"}, {"stage": "Group F", "match_no": 12, "kickoff_utc": "2026-06-15T02:00:00Z", "home": "Sweden", "away": "Tunisia", "location": "Estadio BBVA, Guadalupe"}, {"stage": "Group H", "match_no": 13, "kickoff_utc": "2026-06-15T22:00:00Z", "home": "Saudi Arabia", "away": "Uruguay", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Group H", "match_no": 14, "kickoff_utc": "2026-06-15T16:00:00Z", "home": "Spain", "away": "Cape Verde", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Group G", "match_no": 15, "kickoff_utc": "2026-06-16T01:00:00Z", "home": "Iran", "away": "New Zealand", "location": "SoFi Stadium, Inglewood"}, {"stage": "Group G", "match_no": 16, "kickoff_utc": "2026-06-15T19:00:00Z", "home": "Belgium", "away": "Egypt", "location": "Lumen Field, Seattle"}, {"stage": "Group I", "match_no": 17, "kickoff_utc": "2026-06-16T19:00:00Z", "home": "France", "away": "Senegal", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group I", "match_no": 18, "kickoff_utc": "2026-06-16T22:00:00Z", "home": "Iraq", "away": "Norway", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group J", "match_no": 19, "kickoff_utc": "2026-06-17T01:00:00Z", "home": "Argentina", "away": "Algeria", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Group J", "match_no": 20, "kickoff_utc": "2026-06-17T03:59:00Z", "home": "Austria", "away": "Jordan", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group L", "match_no": 21, "kickoff_utc": "2026-06-17T20:00:00Z", "home": "England", "away": "Croatia", "location": "AT&T Stadium, Arlington"}, {"stage": "Group L", "match_no": 22, "kickoff_utc": "2026-06-17T23:00:00Z", "home": "Ghana", "away": "Panama", "location": "BMO Field, Toronto"}, {"stage": "Group K", "match_no": 23, "kickoff_utc": "2026-06-17T17:00:00Z", "home": "Portugal", "away": "Congo DR", "location": "NRG Stadium, Houston"}, {"stage": "Group K", "match_no": 24, "kickoff_utc": "2026-06-18T02:00:00Z", "home": "Uzbekistan", "away": "Colombia", "location": "Estadio Azteca, Mexico City"}, {"stage": "Group A", "match_no": 25, "kickoff_utc": "2026-06-18T16:00:00Z", "home": "Czechia", "away": "South Africa", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Group B", "match_no": 26, "kickoff_utc": "2026-06-18T19:00:00Z", "home": "Switzerland", "away": "Bosnia and Herzegovina", "location": "SoFi Stadium, Inglewood"}, {"stage": "Group B", "match_no": 27, "kickoff_utc": "2026-06-18T22:00:00Z", "home": "Canada", "away": "Qatar", "location": "BC Place, Vancouver"}, {"stage": "Group A", "match_no": 28, "kickoff_utc": "2026-06-19T01:00:00Z", "home": "Mexico", "away": "South Korea", "location": "Estadio Akron, Zapopan"}, {"stage": "Group C", "match_no": 29, "kickoff_utc": "2026-06-20T01:00:00Z", "home": "Brazil", "away": "Haiti", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group C", "match_no": 30, "kickoff_utc": "2026-06-19T22:00:00Z", "home": "Scotland", "away": "Morocco", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group D", "match_no": 31, "kickoff_utc": "2026-06-20T03:59:00Z", "home": "Türkiye", "away": "Paraguay", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group D", "match_no": 32, "kickoff_utc": "2026-06-19T19:00:00Z", "home": "United States", "away": "Australia", "location": "Lumen Field, Seattle"}, {"stage": "Group E", "match_no": 33, "kickoff_utc": "2026-06-20T20:00:00Z", "home": "Germany", "away": "Ivory Coast", "location": "BMO Field, Toronto"}, {"stage": "Group E", "match_no": 34, "kickoff_utc": "2026-06-21T00:00:00Z", "home": "Ecuador", "away": "Curacao", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Group F", "match_no": 35, "kickoff_utc": "2026-06-20T17:00:00Z", "home": "Netherlands", "away": "Sweden", "location": "NRG Stadium, Houston"}, {"stage": "Group F", "match_no": 36, "kickoff_utc": "2026-06-21T03:59:00Z", "home": "Tunisia", "away": "Japan", "location": "Estadio BBVA, Guadalupe"}, {"stage": "Group H", "match_no": 37, "kickoff_utc": "2026-06-21T22:00:00Z", "home": "Uruguay", "away": "Cape Verde", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Group H", "match_no": 38, "kickoff_utc": "2026-06-21T16:00:00Z", "home": "Spain", "away": "Saudi Arabia", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Group G", "match_no": 39, "kickoff_utc": "2026-06-21T19:00:00Z", "home": "Belgium", "away": "Iran", "location": "Sofi Stadium, Inglewood"}, {"stage": "Group G", "match_no": 40, "kickoff_utc": "2026-06-22T01:00:00Z", "home": "New Zealand", "away": "Egypt", "location": "BC Place, Vancouver"}, {"stage": "Group I", "match_no": 41, "kickoff_utc": "2026-06-23T00:00:00Z", "home": "Norway", "away": "Senegal", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group I", "match_no": 42, "kickoff_utc": "2026-06-22T21:00:00Z", "home": "France", "away": "Iraq", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group J", "match_no": 43, "kickoff_utc": "2026-06-22T17:00:00Z", "home": "Argentina", "away": "Austria", "location": "AT&T Stadium, Arlington"}, {"stage": "Group J", "match_no": 44, "kickoff_utc": "2026-06-23T03:00:00Z", "home": "Jordan", "away": "Algeria", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group L", "match_no": 45, "kickoff_utc": "2026-06-23T20:00:00Z", "home": "England", "away": "Ghana", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group L", "match_no": 46, "kickoff_utc": "2026-06-23T23:00:00Z", "home": "Panama", "away": "Croatia", "location": "BMO Field, Toronto"}, {"stage": "Group K", "match_no": 47, "kickoff_utc": "2026-06-23T17:00:00Z", "home": "Portugal", "away": "Uzbekistan", "location": "NRG Stadium, Houston"}, {"stage": "Group K", "match_no": 48, "kickoff_utc": "2026-06-24T02:00:00Z", "home": "Colombia", "away": "Congo DR", "location": "Estadio Akron, Zapopan"}, {"stage": "Group C", "match_no": 49, "kickoff_utc": "2026-06-24T22:00:00Z", "home": "Scotland", "away": "Brazil", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Group C", "match_no": 50, "kickoff_utc": "2026-06-24T22:00:00Z", "home": "Morocco", "away": "Haiti", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Group B", "match_no": 51, "kickoff_utc": "2026-06-24T19:00:00Z", "home": "Switzerland", "away": "Canada", "location": "BC Place, Vancouver"}, {"stage": "Group B", "match_no": 52, "kickoff_utc": "2026-06-24T19:00:00Z", "home": "Bosnia and Herzegovina", "away": "Qatar", "location": "Lumen Field, Seattle"}, {"stage": "Group A", "match_no": 53, "kickoff_utc": "2026-06-25T01:00:00Z", "home": "Czechia", "away": "Mexico", "location": "Estadio Azteca, Mexico City"}, {"stage": "Group A", "match_no": 54, "kickoff_utc": "2026-06-25T01:00:00Z", "home": "South Africa", "away": "South Korea", "location": "Estadio BBVA, Guadalupe"}, {"stage": "Group E", "match_no": 55, "kickoff_utc": "2026-06-25T20:00:00Z", "home": "Curacao", "away": "Ivory Coast", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group E", "match_no": 56, "kickoff_utc": "2026-06-25T20:00:00Z", "home": "Ecuador", "away": "Germany", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group F", "match_no": 57, "kickoff_utc": "2026-06-25T23:00:00Z", "home": "Japan", "away": "Sweden", "location": "AT&T Stadium, Arlington"}, {"stage": "Group F", "match_no": 58, "kickoff_utc": "2026-06-25T23:00:00Z", "home": "Tunisia", "away": "Netherlands", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Group D", "match_no": 59, "kickoff_utc": "2026-06-26T02:00:00Z", "home": "Türkiye", "away": "United States", "location": "SoFi Stadium, Inglewood"}, {"stage": "Group D", "match_no": 60, "kickoff_utc": "2026-06-26T02:00:00Z", "home": "Paraguay", "away": "Australia", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group I", "match_no": 61, "kickoff_utc": "2026-06-26T19:00:00Z", "home": "Norway", "away": "France", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group I", "match_no": 62, "kickoff_utc": "2026-06-26T19:00:00Z", "home": "Senegal", "away": "Iraq", "location": "BMO Field, Toronto"}, {"stage": "Group G", "match_no": 63, "kickoff_utc": "2026-06-27T03:00:00Z", "home": "Egypt", "away": "Iran", "location": "Lumen Field, Seattle"}, {"stage": "Group G", "match_no": 64, "kickoff_utc": "2026-06-27T03:00:00Z", "home": "New Zealand", "away": "Belgium", "location": "BC Place, Vancouver"}, {"stage": "Group H", "match_no": 65, "kickoff_utc": "2026-06-27T00:00:00Z", "home": "Cape Verde", "away": "Saudi Arabia", "location": "NRG Stadium, Houston"}, {"stage": "Group H", "match_no": 66, "kickoff_utc": "2026-06-27T00:00:00Z", "home": "Uruguay", "away": "Spain", "location": "Estadio Akron, Zapopan"}, {"stage": "Group L", "match_no": 67, "kickoff_utc": "2026-06-27T21:00:00Z", "home": "Panama", "away": "England", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group L", "match_no": 68, "kickoff_utc": "2026-06-27T21:00:00Z", "home": "Croatia", "away": "Ghana", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group J", "match_no": 69, "kickoff_utc": "2026-06-28T02:00:00Z", "home": "Algeria", "away": "Austria", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Group J", "match_no": 70, "kickoff_utc": "2026-06-28T02:00:00Z", "home": "Jordan", "away": "Argentina", "location": "AT&T Stadium, Arlington"}, {"stage": "Group K", "match_no": 71, "kickoff_utc": "2026-06-27T23:30:00Z", "home": "Colombia", "away": "Portugal", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Group K", "match_no": 72, "kickoff_utc": "2026-06-27T23:30:00Z", "home": "Congo DR", "away": "Uzbekistan", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Round of 32", "match_no": 73, "kickoff_utc": "2026-06-28T19:00:00Z", "home": "2A", "away": "2B", "location": "Sofi Stadium, Inglewood"}, {"stage": "Round of 32", "match_no": 74, "kickoff_utc": "2026-06-29T20:30:00Z", "home": "1E", "away": "3ABCDF", "location": "Gillette Stadium, Foxborough"}, {"stage": "Round of 32", "match_no": 75, "kickoff_utc": "2026-06-30T01:00:00Z", "home": "1F", "away": "2C", "location": "Estadio BBVA, Guadalupe"}, {"stage": "Round of 32", "match_no": 76, "kickoff_utc": "2026-06-29T17:00:00Z", "home": "1C", "away": "2F", "location": "NRG Stadium, Houston"}, {"stage": "Round of 32", "match_no": 77, "kickoff_utc": "2026-06-30T21:00:00Z", "home": "1I", "away": "3CDFGH", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Round of 32", "match_no": 78, "kickoff_utc": "2026-06-30T17:00:00Z", "home": "2E", "away": "2I", "location": "AT&T Stadium, Arlington"}, {"stage": "Round of 32", "match_no": 79, "kickoff_utc": "2026-07-01T01:00:00Z", "home": "1A", "away": "3CEFHI", "location": "Estadio Azteca, Mexico City"}, {"stage": "Round of 32", "match_no": 80, "kickoff_utc": "2026-07-01T16:00:00Z", "home": "1L", "away": "3EHIJK", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Round of 32", "match_no": 81, "kickoff_utc": "2026-07-02T00:00:00Z", "home": "1D", "away": "3BEFIJ", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Round of 32", "match_no": 82, "kickoff_utc": "2026-07-01T20:00:00Z", "home": "1G", "away": "3AEHIJ", "location": "Lumen Field, Seattle"}, {"stage": "Round of 32", "match_no": 83, "kickoff_utc": "2026-07-02T23:00:00Z", "home": "2K", "away": "2L", "location": "BMO Field, Toronto"}, {"stage": "Round of 32", "match_no": 84, "kickoff_utc": "2026-07-02T19:00:00Z", "home": "1H", "away": "2J", "location": "Sofi Stadium, Inglewood"}, {"stage": "Round of 32", "match_no": 85, "kickoff_utc": "2026-07-03T03:00:00Z", "home": "1B", "away": "3EFGIJ", "location": "BC Place, Vancouver"}, {"stage": "Round of 32", "match_no": 86, "kickoff_utc": "2026-07-03T22:00:00Z", "home": "1J", "away": "2H", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Round of 32", "match_no": 87, "kickoff_utc": "2026-07-04T01:30:00Z", "home": "1K", "away": "3DEIJL", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Round of 32", "match_no": 88, "kickoff_utc": "2026-07-03T18:00:00Z", "home": "2D", "away": "2G", "location": "AT&T Stadium, Arlington"}, {"stage": "Round of 16", "match_no": 89, "kickoff_utc": "2026-07-04T21:00:00Z", "home": "W74", "away": "W77", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Round of 16", "match_no": 90, "kickoff_utc": "2026-07-04T17:00:00Z", "home": "W73", "away": "W75", "location": "NRG Stadium, Houston"}, {"stage": "Round of 16", "match_no": 91, "kickoff_utc": "2026-07-05T20:00:00Z", "home": "W76", "away": "W78", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Round of 16", "match_no": 92, "kickoff_utc": "2026-07-06T00:00:00Z", "home": "W79", "away": "W80", "location": "Estadio Azteca, Mexico City"}, {"stage": "Round of 16", "match_no": 93, "kickoff_utc": "2026-07-06T19:00:00Z", "home": "W83", "away": "W84", "location": "AT&T Stadium, Arlington"}, {"stage": "Round of 16", "match_no": 94, "kickoff_utc": "2026-07-07T00:00:00Z", "home": "W81", "away": "W82", "location": "Lumen Field, Seattle"}, {"stage": "Round of 16", "match_no": 95, "kickoff_utc": "2026-07-07T16:00:00Z", "home": "W86", "away": "W88", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Round of 16", "match_no": 96, "kickoff_utc": "2026-07-07T20:00:00Z", "home": "W85", "away": "W87", "location": "BC Place, Vancouver"}, {"stage": "Quarterfinals", "match_no": 97, "kickoff_utc": "2026-07-09T20:00:00Z", "home": "W89", "away": "W90", "location": "Gillette Stadium, Foxborough"}, {"stage": "Quarterfinals", "match_no": 98, "kickoff_utc": "2026-07-10T19:00:00Z", "home": "W93", "away": "W94", "location": "Sofi Stadium, Inglewood"}, {"stage": "Quarterfinals", "match_no": 99, "kickoff_utc": "2026-07-11T21:00:00Z", "home": "W91", "away": "W92", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Quarterfinals", "match_no": 100, "kickoff_utc": "2026-07-12T01:00:00Z", "home": "W95", "away": "W96", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Semifinals", "match_no": 101, "kickoff_utc": "2026-07-14T19:00:00Z", "home": "W97", "away": "W98", "location": "AT&T Stadium, Arlington"}, {"stage": "Semifinals", "match_no": 102, "kickoff_utc": "2026-07-15T19:00:00Z", "home": "W99", "away": "W100", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Third Place", "match_no": 103, "kickoff_utc": "2026-07-18T21:00:00Z", "home": "L101", "away": "L102", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Final", "match_no": 104, "kickoff_utc": "2026-07-19T19:00:00Z", "home": "W101", "away": "W102", "location": "MetLife Stadium, East Rutherford"}];

// Ametlikud ajaparandused, mida API-Football ei tohi tagasi valeks kirjutada.
// Võti on MM mängunumber ja väärtus on UTC aeg.
const OFFICIAL_KICKOFF_OVERRIDES_UTC = {
  78: "2026-06-30T17:00:00Z"
};

function normalizedIsoTime(value){
  if (!value) return "";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : "";
}

function officialKickoffOverrideUtcForMatch(match){
  const no = Number(match?.match_no);
  if (!Number.isFinite(no)) return "";
  return OFFICIAL_KICKOFF_OVERRIDES_UTC[no] || "";
}

function seedKickoffUtcForMatch(match){
  const no = Number(match?.match_no);
  if (!Number.isFinite(no)) return "";
  const seed = (SEED_MATCHES || []).find(m => Number(m?.match_no) === no);
  return seed?.kickoff_utc || "";
}

function trustedKickoffUtcForLock(match){
  if (!isMainWorldCupMatch(match)) return match?.kickoff_utc || "";

  // Teiste ennustuste avamine ja tulevase fake tulemuse puhastus ei tohi sõltuda
  // andmebaasis kogemata valeks kirjutatud kickoff_utc väärtusest.
  // Kasutame esmalt käsitsi lukustatud ametlikku override'i, siis seed-tabeli MM aega.
  return officialKickoffOverrideUtcForMatch(match) || seedKickoffUtcForMatch(match) || match?.kickoff_utc || "";
}

function forcedOfficialKickoffPatchForMatch(match){
  const official = officialKickoffOverrideUtcForMatch(match);
  if (!official) return {};
  if (normalizedIsoTime(match?.kickoff_utc) === normalizedIsoTime(official)) return {};
  return { kickoff_utc: official };
}



const U17_TEST_MATCHES = [
  {
    stage: "UEFA U17 TEST",
    match_no: -3,
    kickoff_utc: "2026-06-04T11:30:00Z",
    home: "Belgium U17",
    away: "France U17",
    location: "Kadriorg Stadium"
  },
  {
    stage: "UEFA U17 TEST",
    match_no: -2,
    kickoff_utc: "2026-06-04T17:00:00Z",
    home: "Italy U17",
    away: "Spain U17",
    location: "Lilleküla Stadium"
  },
  {
    stage: "UEFA U17 TEST",
    match_no: -1,
    kickoff_utc: "2026-06-07T17:00:00Z",
    home: "Belgium/France U17",
    away: "Italy/Spain U17",
    location: "Lilleküla Stadium"
  }
];


const BALTIC_CUP_TEST_MATCHES = [
  {
    stage: "BALTIC CUP TEST",
    match_no: -23,
    kickoff_utc: "2026-06-06T13:00:00Z",
    home: "Lithuania",
    away: "Latvia",
    location: "Darius and Girėnas Stadium, Kaunas"
  },
  {
    stage: "BALTIC CUP TEST",
    match_no: -22,
    kickoff_utc: "2026-06-06T15:00:00Z",
    home: "Estonia",
    away: "Faroe Islands",
    location: "Lilleküla Stadium, Tallinn"
  },
  {
    stage: "BALTIC CUP TEST",
    match_no: -21,
    kickoff_utc: "2026-06-09T13:00:00Z",
    home: "L-23",
    away: "L-22",
    location: "Baltic Cup 3rd place"
  },
  {
    stage: "BALTIC CUP TEST",
    match_no: -20,
    kickoff_utc: "2026-06-09T15:00:00Z",
    home: "W-23",
    away: "W-22",
    location: "Baltic Cup Final"
  }
];

function json(statusCode, obj, headers = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      ...headers
    },
    body: JSON.stringify(obj)
  };
}

function getEnv(name) {
  if (name === "SUPABASE_URL") return getSupabaseUrl();
  if (name === "SUPABASE_SERVICE_ROLE_KEY") {
    const key = getSupabaseKey();
    if (!key) throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
    return key;
  }
  if (name === "JWT_SECRET") return getJwtSecret();

  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function sbAdmin() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!key) {
    throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, { auth: { persistSession: false }, realtime: { transport: WebSocket } });
}

function parseRoute(event) {
  const p = event.path || "";
  const m = p.match(/\/api\/(.*)$/) || p.match(/\/\.netlify\/functions\/api\/(.*)$/);
  return m ? (m[1] || "") : "";
}

function tokenFrom(event) {
  const h = event.headers || {};
  const a = h.authorization || h.Authorization || "";
  const m = a.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function userFrom(event) {
  const t = tokenFrom(event);
  if (!t) return null;
  try { return jwt.verify(t, getEnv("JWT_SECRET")); } catch { return null; }
}

async function freshUserFrom(sb, event) {
  const tokenUser = userFrom(event);
  if (!tokenUser?.sub) return null;

  const q = await sb
    .from("players")
    .select("id,username,display_name,is_admin")
    .eq("id", tokenUser.sub)
    .single();

  if (q.error || !q.data) return null;

  return {
    sub: q.data.id,
    id: q.data.id,
    username: q.data.username,
    display_name: q.data.display_name,
    is_admin: !!q.data.is_admin
  };
}

async function requireAdmin(sb, event) {
  const u = await freshUserFrom(sb, event);
  return u && u.is_admin ? u : null;
}


const DEFAULT_RULES_TEXT = "Reeglid\n\nSiin on kõik väga lihtsalt kirjas.\n\n1. Ennusta mängu skoori\n\nIga mängu juures pane kirja, mitu väravat lööb kodumeeskond ja mitu väravat lööb võõrsilmeeskond.\n\nNäide:\nEesti 2 : 1 Läti\n\nSee tähendab, et arvad, et Eesti lööb 2 väravat ja Läti lööb 1 värava.\n\n2. Punktid mängude eest\n\nÕige võitja või õige viik annab 2 punkti.\n\nNäide:\nSina ennustad 2 : 1\nMäng lõpeb 1 : 0\nVõitja on õige, saad 2 punkti.\n\nÕige kodutiimi väravate arv annab 1 punkti.\n\nNäide:\nSina ennustad 2 : 1\nMäng lõpeb 2 : 0\nKodutiimi väravate arv oli õige, saad 1 punkti.\n\nÕige võõrsiltiimi väravate arv annab 1 punkti.\n\nNäide:\nSina ennustad 2 : 1\nMäng lõpeb 3 : 1\nVõõrsiltiimi väravate arv oli õige, saad 1 punkti.\n\nTäpne skoor annab kokku 4 punkti.\n\nNäide:\nSina ennustad 2 : 1\nMäng lõpeb 2 : 1\nKõik oli õige, saad 4 punkti.\n\n3. Play-off mängud\n\nPlay-offis ennustame 90 minuti skoori.\n\nKui mäng lõpeb 90 minutiga, siis punkte saad sama moodi nagu tavalises mängus.\n\nKui play-off mäng läheb lisaajale või penaltitele, siis saad 1 lisapunkti, kui arvasid õige edasipääseja.\n\nNäide:\nSina ennustad 1 : 1 ja valid, et edasi saab Eesti.\nMäng on 90 minuti järel 1 : 1 ja Eesti pääseb edasi.\nSaad täpse skoori eest 4 punkti ja edasipääseja eest 1 punkti.\nKokku 5 punkti.\n\nTabelis näed seda nii:\n4+1p\n\nSee tähendab:\n4 punkti skoori eest\n1 punkt edasipääseja eest\n\n4. Millal teiste ennustusi näeb?\n\nTeiste ennustusi näeb siis, kui mäng on lukus.\n\nMäng läheb lukku 1 tund enne mängu algust.\n\nPärast seda ei saa selle mängu ennustust enam muuta.\n\n5. Lisaküsimused\n\nLisaküsimused annavad lisapunkte play-off edetabelisse.\n\nIga õigesti vastatud lisaküsimus annab 3 punkti.\n\n6. Edetabelid\n\nAlagrupiturniiri edetabel näitab ainult alagrupimängude punkte.\n\nPlay-off edetabel näitab play-off mängude punkte ja lisaküsimuste punkte.\n\nÜldtabel näitab kõik punktid kokku:\nalagrupimängud + play-off mängud + lisaküsimused.\n\n7. Auhinnarahad\n\nAlagrupi turna 550€\n1. koht 300€\n2. koht 150€\n3. koht 100€\n\nRehamängude turna 550€\n1. koht 300€\n2. koht 150€\n3. koht 100€\n\nLisaks 90€ kahe turniiri punktisumma üldvõitjale.\n";

async function getRulesText(sb){
  try {
    const q = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "rules_text")
      .maybeSingle();

    if (!q.error && q.data && typeof q.data.value === "string") {
      return { text: q.data.value, settings_available: true };
    }

    return { text: DEFAULT_RULES_TEXT, settings_available: !q.error, settings_error: q.error?.message || null };
  } catch (err) {
    return { text: DEFAULT_RULES_TEXT, settings_available: false, settings_error: err.message };
  }
}


function outcome(h,a){ return h>a?1:h<a?-1:0; }

function normalizeWinner(value){
  const v = String(value || "").trim().toLowerCase();
  if (["home", "kodu", "h", "1"].includes(v)) return "home";
  if (["away", "võõrsil", "a", "2"].includes(v)) return "away";
  return null;
}

function isPlayoffMatch(match){
  const n = Number(match?.match_no);

  // U17 testmängud kasutavad negatiivseid mängunumbreid ja on testimiseks play-off loogikaga.
  if (Number.isFinite(n) && n < 0) return true;

  if (Number.isFinite(n) && n >= 73) return true;

  const stage = String(match?.stage || "").trim().toLowerCase();
  if (!stage) return false;
  if (stage.includes("u17")) return true;
  if (stage.startsWith("group")) return false;
  return true;
}

function predictedAdvancerFromPrediction(ph, pa, predWinner){
  if (ph > pa) return "home";
  if (ph < pa) return "away";
  return normalizeWinner(predWinner);
}

function actualAdvancerFromResult(fh, fa, winner){
  const normalizedWinner = normalizeWinner(winner);
  if (normalizedWinner) return normalizedWinner;
  if (fh > fa) return "home";
  if (fh < fa) return "away";
  return null;
}

function truthyDbBool(value){
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function matchWentExtra(match){
  return truthyDbBool(match?.went_extra);
}

function inferWentExtraFromResult(match, fh, fa, winner){
  if (!isPlayoffMatch(match)) return false;
  if (Number(fh) !== Number(fa)) return false;
  return !!normalizeWinner(winner ?? match?.winner);
}

function calcPoints(ph, pa, fh, fa, options = {}){
  if (fh===null || fa===null || fh===undefined || fa===undefined) return 0;

  ph = Number(ph);
  pa = Number(pa);
  fh = Number(fh);
  fa = Number(fa);
  if (![ph, pa, fh, fa].every(Number.isFinite)) return 0;

  let points = 0;

  if (outcome(ph, pa) === outcome(fh, fa)) points += 2;
  if (ph === fh) points += 1;
  if (pa === fa) points += 1;

  const match = options.match || {};
  const playoff = options.is_playoff === true || isPlayoffMatch(match);
  const actualWinner = actualAdvancerFromResult(fh, fa, options.winner ?? match.winner);
  // Play-off lisaaja/penaltite +1 käib õige edasipääseja eest.
  // Mitte-viigiline ennustus annab edasipääsejaks ennustatud võitja; viigi korral kasutatakse pred_winner valikut.
  const predictedWinner = predictedAdvancerFromPrediction(ph, pa, options.pred_winner);
  const extraOrPenalties = matchWentExtra(match) || inferWentExtraFromResult(match, fh, fa, options.winner ?? match.winner);

  if (
    playoff &&
    extraOrPenalties &&
    actualWinner &&
    predictedWinner &&
    actualWinner === predictedWinner
  ) {
    points += 1;
  }

  return points;
}

const BONUS_QUESTIONS_SEED = [
  { question_text: "Milline koondis tuleb maailmameistriks?", answer_type: "team", options_source: "fifa_2026_teams" },
  { question_text: "Kes on turniiri suurim väravakütt?", answer_type: "player", options_source: "fifa_2026_players" },
  { question_text: "Mitu väravat lööb oma viimasel suurturniiril Messi?", answer_type: "number", options_source: "number_0_20" },
  { question_text: "Mitu väravat lööb oma viimasel suurturniiril Ronaldo?", answer_type: "number", options_source: "number_0_20" },
  { question_text: "Kes võidab meie alagrupiturniiri ennustuse?", answer_type: "registered_user", options_source: "registered_users" },
  { question_text: "Kes jääb meie alagrupiturniiri ennustuses viimaseks?", answer_type: "registered_user", options_source: "registered_users" }
];

function inferBonusAnswerType(questionText){
  const q = String(questionText || "").toLowerCase();
  if (q.includes("maailmameistriks")) return { answer_type: "team", options_source: "fifa_2026_teams" };
  if (q.includes("suurim väravakütt")) return { answer_type: "player", options_source: "fifa_2026_players" };
  if (q.includes("messi")) return { answer_type: "number", options_source: "number_0_20" };
  if (q.includes("ronaldo")) return { answer_type: "number", options_source: "number_0_20" };
  if (q.includes("võidab meie alagrupiturniiri")) return { answer_type: "registered_user", options_source: "registered_users" };
  if (q.includes("jääb meie alagrupiturniiri")) return { answer_type: "registered_user", options_source: "registered_users" };
  return { answer_type: "text", options_source: "" };
}

function normalizeBonusCompare(value){
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function ensureBonusQuestions(sb){
  const existing = await sb
    .from("bonus_questions")
    .select("*")
    .order("sort_order", { ascending: true });

  if (existing.error) {
    if (String(existing.error.message || "").toLowerCase().includes("does not exist")) {
      throw new Error("Puudub bonus_questions tabel. Käivita sql/bonus_questions_migration.sql");
    }
    throw new Error(existing.error.message);
  }

  const current = existing.data || [];

  for (let i = 0; i < BONUS_QUESTIONS_SEED.length; i++) {
    const sort_order = i + 1;
    const seed = BONUS_QUESTIONS_SEED[i];
    const question_text = typeof seed === "string" ? seed : seed.question_text;
    const typeInfo = typeof seed === "string" ? inferBonusAnswerType(question_text) : seed;
    const row = current.find(q => Number(q.sort_order) === sort_order);

    if (!row) {
      const ins = await sb.from("bonus_questions").insert({
        question_text,
        sort_order,
        points: 3,
        active: true,
        answer_type: typeInfo.answer_type || "text",
        options_source: typeInfo.options_source || null
      });
      if (ins.error) throw new Error(ins.error.message);
    }
  }
}


function isMissingSupabaseTableError(error){
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("relation") && text.includes("does not exist") ||
    text.includes("42p01")
  );
}

function parseSettingBool(value){
  if (typeof value === "boolean") return value;
  const v = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "jah", "on"].includes(v);
}

async function getBonusManualLockInfo(sb){
  const res = await sb
    .from("app_settings")
    .select("value,updated_at")
    .eq("key", "bonus_manual_locked")
    .maybeSingle();

  if (res.error) {
    if (isMissingSupabaseTableError(res.error)) {
      return {
        manual_locked: false,
        manual_lock_available: false,
        manual_lock_error: "Puudub app_settings tabel. Käivita sql/app_settings_bonus_lock.sql"
      };
    }
    return {
      manual_locked: false,
      manual_lock_available: false,
      manual_lock_error: res.error.message
    };
  }

  return {
    manual_locked: parseSettingBool(res.data?.value),
    manual_lock_available: true,
    manual_lock_updated_at: res.data?.updated_at || null,
    manual_lock_error: null
  };
}

async function setBonusManualLock(sb, locked){
  const payload = {
    key: "bonus_manual_locked",
    value: locked ? "true" : "false",
    updated_at: new Date().toISOString()
  };

  const res = await sb
    .from("app_settings")
    .upsert(payload, { onConflict: "key" })
    .select("value,updated_at")
    .single();

  if (res.error) {
    if (isMissingSupabaseTableError(res.error)) {
      throw new Error("Puudub app_settings tabel. Käivita Supabase SQL Editoris sql/app_settings_bonus_lock.sql");
    }
    throw new Error(res.error.message);
  }

  return {
    manual_locked: parseSettingBool(res.data?.value),
    manual_lock_available: true,
    manual_lock_updated_at: res.data?.updated_at || null,
    manual_lock_error: null
  };
}


async function getBonusLockInfo(sb){
  const first = await sb
    .from("matches")
    .select("kickoff_utc,match_no")
    .gt("match_no", 0)
    .not("kickoff_utc", "is", null)
    .order("kickoff_utc", { ascending: true })
    .limit(1);

  if (first.error) throw new Error(first.error.message);

  const kickoff = first.data?.[0]?.kickoff_utc || null;
  const kickoffMs = kickoff ? new Date(kickoff).getTime() : null;
  const lockAtMs = Number.isFinite(kickoffMs) ? kickoffMs - 60 * 60 * 1000 : null;
  const autoLocked = Number.isFinite(lockAtMs) ? Date.now() >= lockAtMs : false;
  const manual = await getBonusManualLockInfo(sb);

  return {
    first_kickoff_utc: kickoff,
    lock_at_utc: Number.isFinite(lockAtMs) ? new Date(lockAtMs).toISOString() : null,
    auto_locked: autoLocked,
    manual_locked: !!manual.manual_locked,
    manual_lock_available: !!manual.manual_lock_available,
    manual_lock_updated_at: manual.manual_lock_updated_at || null,
    manual_lock_error: manual.manual_lock_error || null,
    locked: autoLocked || !!manual.manual_locked
  };
}

function isGroupMatchForLeaderboard(match){
  const n = Number(match?.match_no);
  return Number.isFinite(n) && n >= 1 && n <= 72;
}

function isFinishedGroupStageScoreLocked(match){
  // Alagrupimängude tulemused ei tohi hilisemate API sync'idega enam muutuda.
  // Kui parandust on vaja, teeb admin selle käsitsi tulemuse sisestusega.
  const n = Number(match?.match_no);
  if (!Number.isFinite(n) || n < 1 || n > 72) return false;
  const h = Number(match?.final_home);
  const a = Number(match?.final_away);
  return !!match?.is_finished && Number.isFinite(h) && Number.isFinite(a);
}

function isPlayoffMatchForLeaderboard(match){
  const n = Number(match?.match_no);
  return Number.isFinite(n) && n >= 73 && n <= 104;
}

function addRankMovement(current, previous){
  const previousRank = new Map();
  previous.forEach((row, index) => previousRank.set(row.player_id, index + 1));

  return current.map((row, index) => {
    const rank = index + 1;
    const prev = previousRank.get(row.player_id) || rank;
    const movement = prev - rank;

    return {
      ...row,
      rank,
      previous_rank: prev,
      movement,
      rank_direction: movement > 0 ? "up" : movement < 0 ? "down" : "same"
    };
  });
}

function leaderboardSnapshotFingerprint(rows){
  return (rows || []).map((row, index) => [
    row.player_id,
    index + 1,
    Number(row.points || 0),
    Number(row.group_points || 0),
    Number(row.match_points || 0),
    Number(row.playoff_match_points || 0),
    Number(row.bonus_points || 0)
  ].join(":")).join("|");
}

async function addRankMovementWithSnapshot(sb, leaderboardType, current){
  const rowsWithRank = (current || []).map((row, index) => ({
    ...row,
    rank: index + 1
  }));

  const fingerprint = leaderboardSnapshotFingerprint(rowsWithRank);

  const fallback = () => rowsWithRank.map(row => ({
    ...row,
    previous_rank: row.rank,
    movement: 0,
    rank_direction: "same"
  }));

  const currentSnap = await sb
    .from("leaderboard_rank_snapshots")
    .select("player_id,rank,points,fingerprint")
    .eq("leaderboard_type", leaderboardType)
    .eq("snapshot_role", "current");

  if (currentSnap.error) {
    return fallback();
  }

  const currentSnapshotRows = currentSnap.data || [];
  const currentFingerprint = currentSnapshotRows[0]?.fingerprint || "";
  let previousSnapshotRows = [];

  if (currentSnapshotRows.length && currentFingerprint === fingerprint) {
    const previousSnap = await sb
      .from("leaderboard_rank_snapshots")
      .select("player_id,rank,points,fingerprint")
      .eq("leaderboard_type", leaderboardType)
      .eq("snapshot_role", "previous");

    if (!previousSnap.error) previousSnapshotRows = previousSnap.data || [];
  } else {
    previousSnapshotRows = currentSnapshotRows;

    const delPrevious = await sb
      .from("leaderboard_rank_snapshots")
      .delete()
      .eq("leaderboard_type", leaderboardType)
      .eq("snapshot_role", "previous");

    if (delPrevious.error) return fallback();

    if (currentSnapshotRows.length) {
      const shiftCurrent = await sb
        .from("leaderboard_rank_snapshots")
        .update({ snapshot_role: "previous" })
        .eq("leaderboard_type", leaderboardType)
        .eq("snapshot_role", "current");

      if (shiftCurrent.error) return fallback();
    }

    const payload = rowsWithRank.map(row => ({
      leaderboard_type: leaderboardType,
      snapshot_role: "current",
      player_id: row.player_id,
      rank: row.rank,
      points: Number(row.points || 0),
      fingerprint,
      snapshot_at: new Date().toISOString()
    }));

    if (payload.length) {
      const ins = await sb.from("leaderboard_rank_snapshots").insert(payload);
      if (ins.error) return fallback();
    }
  }

  const previousRank = new Map();
  for (const row of previousSnapshotRows || []) {
    previousRank.set(String(row.player_id), Number(row.rank));
  }

  return rowsWithRank.map(row => {
    const prev = previousRank.get(String(row.player_id)) || row.rank;
    const movement = prev - row.rank;

    return {
      ...row,
      previous_rank: prev,
      movement,
      rank_direction: movement > 0 ? "up" : movement < 0 ? "down" : "same"
    };
  });
}


// FIFA ametliku scores-fixtures/match-centre põhjal lukustatud Round of 32 tegelikud paarid.
// Neid kasutatakse ainult kuvamiseks ja play-off ridade home/away parandamiseks.
// Punktiarvestuse 90 minuti loogika jääb endiselt final_home/final_away väljade peale.
const OFFICIAL_R32_ACTUAL_FIXTURES = new Map([
  [73, { home: "South Africa", away: "Canada" }],
  [74, { home: "Germany", away: "Paraguay" }],
  [75, { home: "Netherlands", away: "Morocco" }],
  [76, { home: "Brazil", away: "Japan" }],
  [77, { home: "France", away: "Sweden" }],
  [78, { home: "Ivory Coast", away: "Norway" }],
  [79, { home: "Mexico", away: "Ecuador" }],
  [80, { home: "England", away: "Congo DR" }],
  [81, { home: "United States", away: "Bosnia and Herzegovina" }],
  [82, { home: "Belgium", away: "Senegal" }],
  [83, { home: "Portugal", away: "Croatia" }],
  [84, { home: "Spain", away: "Austria" }],
  [85, { home: "Switzerland", away: "Algeria" }],
  [86, { home: "Argentina", away: "Cape Verde" }],
  [87, { home: "Colombia", away: "Ghana" }],
  [88, { home: "Australia", away: "Egypt" }]
]);

function officialR32ActualFixtureForMatchNo(matchNo){
  const no = Number(matchNo);
  if (!Number.isFinite(no)) return null;
  return OFFICIAL_R32_ACTUAL_FIXTURES.get(no) || null;
}

function applyOfficialR32ActualTeams(match){
  const actual = officialR32ActualFixtureForMatchNo(match?.match_no);
  if (!actual) return match;
  return { ...match, home: actual.home, away: actual.away, official_r32_actual_fixture: true };
}

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const API_FOOTBALL_LEAGUE_ID = 1;
const API_FOOTBALL_SEASON = 2026;
const API_FOOTBALL_SYNC_COOLDOWN_MS = 30 * 60 * 1000;

// U17 testmängude jaoks lisame UEFA U17 liiga automaatselt.
// Kasutaja võib Railway variables all lisaks panna API_FOOTBALL_EXTRA_LEAGUES=886:2025,886:2026
const API_FOOTBALL_DEFAULT_EXTRA_LEAGUES = [
  { league: 886, season: 2025 },
  { league: 886, season: 2026 }
];

const API_FOOTBALL_ENV_EXTRA_LEAGUES = (process.env.API_FOOTBALL_EXTRA_LEAGUES || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean)
  .map(x => {
    const [leagueRaw, seasonRaw] = x.split(":").map(v => String(v || "").trim());
    const league = Number(leagueRaw);
    const season = Number(seasonRaw || API_FOOTBALL_SEASON);
    return {
      league: Number.isFinite(league) ? league : null,
      season: Number.isFinite(season) ? season : API_FOOTBALL_SEASON
    };
  })
  .filter(x => x.league);

const API_FOOTBALL_EXTRA_LEAGUES = Array.from(
  new Map(
    [...API_FOOTBALL_DEFAULT_EXTRA_LEAGUES, ...API_FOOTBALL_ENV_EXTRA_LEAGUES]
      .map(x => [`${x.league}:${x.season}`, x])
  ).values()
);

let lastApiFootballSyncAt = 0;


const API_FOOTBALL_FETCH_TIMEOUT_MS = 10 * 1000;

async function fetchApiFootball(url, options = {}) {
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(API_FOOTBALL_FETCH_TIMEOUT_MS)
      : undefined;

  return fetch(url, {
    ...options,
    signal: options.signal || timeoutSignal
  });
}

function apiFootballFetchErrorMessage(err){
  const name = String(err?.name || "");
  if (name === "TimeoutError" || name === "AbortError") return "timeout 10s";
  return err?.message || String(err || "fetch failed");
}


function normalizeTeamName(name){
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/côte d['’]ivoire/g, "ivory coast")
    .replace(/cabo verde/g, "cape verde")
    .replace(/cape verde islands/g, "cape verde")
    .replace(/czech republic/g, "czechia")
    .replace(/curaçao/g, "curacao")
    .replace(/bosnia[\s-]*herzegovina/g, "bosnia and herzegovina")
    .replace(/korea republic/g, "south korea")
    .replace(/turkiye/g, "türkiye")
    .replace(/turkey/g, "türkiye")
    .replace(/u\.s\./g, "united states")
    .replace(/usa/g, "united states")
    .replace(/dr congo/g, "congo dr")
    .replace(/republic of ireland/g, "ireland")
    .replace(/[^a-z0-9äöüõ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlaceholderTeam(name){
  const s = String(name || "").trim();
  return /^[WL]\d+$/i.test(s) || /^[123][A-Z]+$/i.test(s) || /^[12][A-L]$/i.test(s) || /^3[A-Z]+$/i.test(s);
}


function apiStatusShort(fx){
  return String(fx?.fixture?.status?.short || "").trim().toUpperCase();
}

function apiFixtureFinished(fx){
  const short = apiStatusShort(fx);
  return ["FT", "AET", "PEN", "AWD", "WO"].includes(short);
}

function apiFixtureWentExtra(fx){
  return ["AET", "PEN"].includes(apiStatusShort(fx));
}

function apiFixtureWinner(fx){
  if (fx?.teams?.home?.winner === true) return "home";
  if (fx?.teams?.away?.winner === true) return "away";

  const gh = Number(fx?.goals?.home);
  const ga = Number(fx?.goals?.away);
  if (Number.isFinite(gh) && Number.isFinite(ga) && gh !== ga) {
    return gh > ga ? "home" : "away";
  }

  return null;
}

function apiNormalTimeScore(fx){
  const fh = fx?.score?.fulltime?.home;
  const fa = fx?.score?.fulltime?.away;

  if (fh !== null && fa !== null && fh !== undefined && fa !== undefined) {
    return { home: Number(fh), away: Number(fa) };
  }

  if (apiFixtureWentExtra(fx)) return null;

  const gh = fx?.goals?.home;
  const ga = fx?.goals?.away;
  if (gh !== null && ga !== null && gh !== undefined && ga !== undefined) {
    return { home: Number(gh), away: Number(ga) };
  }

  return null;
}

function numericScorePair(home, away){
  if (home === null || home === undefined || away === null || away === undefined) return null;
  const h = Number(home);
  const a = Number(away);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  return { home: h, away: a };
}

function apiPlayingTimeScoreWithoutPenalties(fx){
  // Jooksu eesmärk = 90 min + lisaaeg. Penaltiseeria väravaid ei arvestata.
  // Ennustusmängu punktiarvestus kasutab endiselt apiNormalTimeScore() ehk 90 minuti skoori.
  const normal = apiNormalTimeScore(fx);
  const extra = numericScorePair(fx?.score?.extratime?.home, fx?.score?.extratime?.away);

  if (normal && extra && apiFixtureWentExtra(fx)) {
    // API-Football võib anda extratime väärtuse kas lisaaja väravatena või 120 minuti koguskoorina.
    // Kui väärtus on vähemalt 90 minuti skoor, käsitle seda koguskoorina; muidu lisa 90 minuti skoorile.
    if (extra.home >= normal.home && extra.away >= normal.away) return extra;
    return { home: normal.home + extra.home, away: normal.away + extra.away };
  }

  const goals = numericScorePair(fx?.goals?.home, fx?.goals?.away);
  if (apiFixtureWentExtra(fx) && goals) return goals;
  if (normal) return normal;
  if (goals && !apiFixtureWentExtra(fx)) return goals;

  return null;
}

function teamNamesMatch(a, b){
  const x = normalizeTeamName(a);
  const y = normalizeTeamName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 5 && y.length >= 5 && (x.includes(y) || y.includes(x))) return true;
  return false;
}

function fixtureHasTeamNameOverlap(dbMatch, fx){
  const dbTeams = [
    { raw: dbMatch?.home, normalized: normalizeTeamName(dbMatch?.home) },
    { raw: dbMatch?.away, normalized: normalizeTeamName(dbMatch?.away) }
  ].filter(t => t.normalized && !isPlaceholderTeam(t.raw));

  if (!dbTeams.length) return false;

  const apiTeams = [
    fx?.teams?.home?.name,
    fx?.teams?.away?.name
  ];

  return dbTeams.some(db => apiTeams.some(api => teamNamesMatch(db.normalized, api)));
}

function fixtureKickoffMs(fx){
  const raw = fx?.fixture?.date;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

function scoreFixtureMatch(dbMatch, fx){
  let score = 0;
  const dbKick = dbMatch?.kickoff_utc ? new Date(dbMatch.kickoff_utc).getTime() : null;
  const fxKick = fixtureKickoffMs(fx);

  if (Number.isFinite(dbKick) && Number.isFinite(fxKick)){
    const diffMin = Math.abs(dbKick - fxKick) / 60000;
    if (diffMin <= 5) score += 6;
    else if (diffMin <= 30) score += 4;
    else if (diffMin <= 120) score += 2;
  }

  const dbHome = normalizeTeamName(dbMatch?.home);
  const dbAway = normalizeTeamName(dbMatch?.away);
  const fxHome = normalizeTeamName(fx?.teams?.home?.name);
  const fxAway = normalizeTeamName(fx?.teams?.away?.name);

  if (!isPlaceholderTeam(dbMatch?.home) && dbHome && dbHome === fxHome) score += 3;
  if (!isPlaceholderTeam(dbMatch?.away) && dbAway && dbAway === fxAway) score += 3;

  const venue = normalizeTeamName(dbMatch?.location);
  const fxVenue = normalizeTeamName(fx?.fixture?.venue?.name);
  if (venue && fxVenue && (venue.includes(fxVenue) || fxVenue.includes(venue))) score += 2;

  const stage = normalizeTeamName(dbMatch?.stage);
  const round = normalizeTeamName(fx?.league?.round);
  if (stage && round && (round.includes(stage) || stage.includes(round))) score += 1;

  return score;
}

function fixtureDisplayName(fx){
  const id = fx?.fixture?.id || "";
  const home = fx?.teams?.home?.name || "";
  const away = fx?.teams?.away?.name || "";
  return `${id ? "#" + id + " " : ""}${home} - ${away}`.trim();
}

function normalizePlayoffRoundKey(value){
  const s = normalizeTeamName(value);
  if (!s) return "";
  if (s.includes("round of 32") || s.includes("1 16") || s.includes("last 32")) return "r32";
  if (s.includes("round of 16") || s.includes("1 8") || s.includes("last 16")) return "r16";
  if (s.includes("quarter")) return "qf";
  if (s.includes("semi")) return "sf";
  if (s.includes("third") || s.includes("3rd") || s.includes("3 place") || s.includes("third place")) return "third";
  if (s.includes("final")) return "final";
  return "";
}

function playoffRoundKeyFromMatch(match){
  const n = Number(match?.match_no);
  if (Number.isFinite(n)) {
    if (n >= 73 && n <= 88) return "r32";
    if (n >= 89 && n <= 96) return "r16";
    if (n >= 97 && n <= 100) return "qf";
    if (n >= 101 && n <= 102) return "sf";
    if (n === 103) return "third";
    if (n === 104) return "final";
  }
  return normalizePlayoffRoundKey(match?.stage);
}

function playoffRoundKeyFromFixture(fx){
  return normalizePlayoffRoundKey(fx?.league?.round);
}

function isMainWorldCupMatch(match){
  const n = Number(match?.match_no);
  return Number.isFinite(n) && n >= 1 && n <= 104;
}

function matchHasUnresolvedTeamSlot(match){
  if (!isMainWorldCupMatch(match)) return false;
  return isPlaceholderTeam(match?.home) || isPlaceholderTeam(match?.away);
}

function isVisiblePredictionMatch(match){
  // Context-free fallback: for future knockout rounds (89-104) this is intentionally strict.
  // Call sanitizeWorldCupMatchesForDisplay(list) when full bracket context is available.
  if (!isDisplayBasicWorldCupMatch(match)) return false;
  const no = Number(match?.match_no);
  if (Number.isFinite(no) && no >= 89 && no <= 104) return false;
  return true;
}

let worldCupTeamNameCache = null;
function worldCupTeamNameSet(){
  if (!worldCupTeamNameCache) {
    worldCupTeamNameCache = new Set();
    for (const m of SEED_MATCHES || []) {
      const no = Number(m?.match_no);
      if (!Number.isFinite(no) || no < 1 || no > 72) continue;
      for (const name of [m.home, m.away]) {
        const normalized = normalizeTeamName(name);
        if (normalized) worldCupTeamNameCache.add(normalized);
      }
    }
  }
  return worldCupTeamNameCache;
}

function worldCupCanonicalTeamName(name){
  const raw = String(name || "").trim();
  if (!raw) return "";
  const normalized = normalizeTeamName(raw);
  if (!normalized) return "";

  for (const m of SEED_MATCHES || []) {
    const no = Number(m?.match_no);
    if (!Number.isFinite(no) || no < 1 || no > 72) continue;
    for (const seedName of [m.home, m.away]) {
      if (normalizeTeamName(seedName) === normalized) return String(seedName || "").trim();
    }
  }

  return "";
}

function isExpectedWorldCupTeamName(name){
  const raw = String(name || "").trim();
  if (!raw) return false;
  if (isPlaceholderTeam(raw)) return true;
  return !!worldCupCanonicalTeamName(raw);
}

function matchNeedsWorldCupTeamRepair(match){
  if (!isMainWorldCupMatch(match)) return false;
  return [match?.home, match?.away].some(name => {
    const raw = String(name || "").trim();
    return raw && !isExpectedWorldCupTeamName(raw);
  });
}

function matchHasPlaceholderTeam(match){
  return isPlaceholderTeam(match?.home) || isPlaceholderTeam(match?.away);
}


// Official local knockout dependency map. Display and scoring guards must use this map,
// not only current home/away text, because an earlier bad API sync can leave a future
// match with two real-looking but wrong teams (for example #91 Brazil - Morocco).
const WORLD_CUP_KNOCKOUT_SOURCES = Object.freeze({
  89: { home: { type: "W", match_no: 74 }, away: { type: "W", match_no: 77 } },
  90: { home: { type: "W", match_no: 73 }, away: { type: "W", match_no: 75 } },
  91: { home: { type: "W", match_no: 76 }, away: { type: "W", match_no: 78 } },
  92: { home: { type: "W", match_no: 79 }, away: { type: "W", match_no: 80 } },
  93: { home: { type: "W", match_no: 83 }, away: { type: "W", match_no: 84 } },
  94: { home: { type: "W", match_no: 81 }, away: { type: "W", match_no: 82 } },
  95: { home: { type: "W", match_no: 86 }, away: { type: "W", match_no: 88 } },
  96: { home: { type: "W", match_no: 85 }, away: { type: "W", match_no: 87 } },
  97: { home: { type: "W", match_no: 89 }, away: { type: "W", match_no: 90 } },
  98: { home: { type: "W", match_no: 93 }, away: { type: "W", match_no: 94 } },
  99: { home: { type: "W", match_no: 91 }, away: { type: "W", match_no: 92 } },
  100: { home: { type: "W", match_no: 95 }, away: { type: "W", match_no: 96 } },
  101: { home: { type: "W", match_no: 97 }, away: { type: "W", match_no: 98 } },
  102: { home: { type: "W", match_no: 99 }, away: { type: "W", match_no: 100 } },
  103: { home: { type: "L", match_no: 101 }, away: { type: "L", match_no: 102 } },
  104: { home: { type: "W", match_no: 101 }, away: { type: "W", match_no: 102 } }
});

function worldCupMatchHasStoredResultFields(match){
  return !!match && (
    match.final_home !== null && match.final_home !== undefined ||
    match.final_away !== null && match.final_away !== undefined ||
    !!normalizeWinner(match.winner) ||
    !!match.is_finished ||
    !!truthyDbBool(match.went_extra) ||
    String(match.api_status_short || "").trim() !== ""
  );
}

function isPrematureWorldCupResult(match, now = Date.now()){
  if (!isMainWorldCupMatch(match)) return false;
  if (!worldCupMatchHasStoredResultFields(match)) return false;

  const kickoffUtc = trustedKickoffUtcForLock(match);
  const kickoff = kickoffUtc ? new Date(kickoffUtc).getTime() : null;
  return Number.isFinite(kickoff) && now < kickoff;
}

function isPredictionRevealOpen(match, now = Date.now()){
  const kickoffUtc = trustedKickoffUtcForLock(match);
  const kickoff = kickoffUtc ? new Date(kickoffUtc).getTime() : null;
  if (Number.isFinite(kickoff)) return now >= (kickoff - 60 * 60 * 1000);
  // Fallback for legacy/admin rows without kickoff. Normal MM rows must have kickoff_utc.
  return !!match?.is_finished;
}

function stripPrematureWorldCupResultForDisplay(match){
  if (!match || !isPrematureWorldCupResult(match)) return match;
  return {
    ...match,
    final_home: null,
    final_away: null,
    winner: null,
    is_finished: false,
    went_extra: false,
    api_status_short: ""
  };
}

function matchHasUsableResult(match){
  return !!match && !isPrematureWorldCupResult(match) && (
    !!match.is_finished ||
    (match.final_home !== null && match.final_home !== undefined && match.final_away !== null && match.final_away !== undefined)
  );
}

function actualAdvancingSideForMatch(match){
  if (!matchHasUsableResult(match)) return null;
  const fh = Number(match?.final_home);
  const fa = Number(match?.final_away);
  const winner = normalizeWinner(match?.winner);
  if (winner) return winner;
  if (Number.isFinite(fh) && Number.isFinite(fa) && fh !== fa) return fh > fa ? "home" : "away";
  return null;
}

function actualLosingSideForMatch(match){
  const winner = actualAdvancingSideForMatch(match);
  if (winner === "home") return "away";
  if (winner === "away") return "home";
  return null;
}

function isDisplayBasicWorldCupMatch(match){
  return isMainWorldCupMatch(match) && !matchHasUnresolvedTeamSlot(match) && !matchNeedsWorldCupTeamRepair(match);
}

function resolvedKnockoutSourceTeamName(source, byNo, stack = new Set()){
  const refNo = Number(source?.match_no);
  const type = String(source?.type || "W").toUpperCase();
  if (!Number.isFinite(refNo)) return null;
  const refMatch = byNo.get(refNo);
  if (!refMatch) return null;

  // Source match itself must be valid for display/bracket first. This blocks chained bad data.
  if (!isVisiblePredictionMatchInContext(refMatch, byNo, stack)) return null;
  if (!matchHasUsableResult(refMatch)) return null;

  const side = type === "L" ? actualLosingSideForMatch(refMatch) : actualAdvancingSideForMatch(refMatch);
  if (side === "home") return String(refMatch.home || "").trim();
  if (side === "away") return String(refMatch.away || "").trim();
  return null;
}

function isVisiblePredictionMatchInContext(match, byNo, stack = new Set()){
  if (!isDisplayBasicWorldCupMatch(match)) return false;

  const no = Number(match?.match_no);
  if (!Number.isFinite(no)) return false;
  if (no <= 88) return true;

  const sources = WORLD_CUP_KNOCKOUT_SOURCES[no];
  if (!sources) return true;
  if (stack.has(no)) return false;

  const nextStack = new Set(stack);
  nextStack.add(no);

  const expectedHome = resolvedKnockoutSourceTeamName(sources.home, byNo, nextStack);
  const expectedAway = resolvedKnockoutSourceTeamName(sources.away, byNo, nextStack);

  if (!expectedHome || !expectedAway) return false;
  return teamNamesMatch(match.home, expectedHome) && teamNamesMatch(match.away, expectedAway);
}

function isInvalidResolvedKnockoutMatch(match, byNo){
  if (!isMainWorldCupMatch(match)) return false;
  const no = Number(match?.match_no);
  if (!Number.isFinite(no) || no < 89 || no > 104) return false;

  const sources = WORLD_CUP_KNOCKOUT_SOURCES[no];
  if (!sources) return false;

  // If the row has score/status but is not a valid resolved bracket slot, treat that as bad sync data.
  if (!matchHasUsableResult(match) && !normalizeWinner(match?.winner) && !truthyDbBool(match?.went_extra) && !String(match?.api_status_short || "").trim()) return false;

  return !isVisiblePredictionMatchInContext(match, byNo);
}

function apiFixtureIsMainWorldCup(fx){
  const leagueId = Number(fx?.league?.id);
  const season = Number(fx?.league?.season);
  const leagueName = normalizeTeamName(fx?.league?.name);
  const seasonOk = !Number.isFinite(season) || season === Number(API_FOOTBALL_SEASON);

  // Päris MM mängud 1-104 tohivad võtta vaste ainult API-Footballi põhiliigast.
  // Kuupäeva endpoint võib samal päeval tagastada ka World Cup U17/U20, naiste, klubi või muu sarja mänge.
  // Nime järgi "world cup" lubamine oli liiga lai ja põhjustas U20 nimede sattumist MM tabelisse.
  if (leagueId === Number(API_FOOTBALL_LEAGUE_ID) && seasonOk) return true;

  // Harv fallback ainult siis, kui API ei anna league.id väärtust, aga liiga nimi on täpselt põhivõistlus.
  if (!Number.isFinite(leagueId) && seasonOk && ["world cup", "fifa world cup"].includes(leagueName)) return true;

  return false;
}

function fixtureAllowedForMatch(match, fx){
  if (isMainWorldCupMatch(match)) return apiFixtureIsMainWorldCup(fx);
  return true;
}

function sanitizeWorldCupMatchForDisplay(match){
  if (!isMainWorldCupMatch(match)) return match;

  const seed = seedMatchByNoMap().get(Number(match?.match_no));
  if (!seed) return match;

  let clean = { ...match };
  if (String(clean.home || "").trim() && !isExpectedWorldCupTeamName(clean.home)) clean.home = seed.home;
  if (String(clean.away || "").trim() && !isExpectedWorldCupTeamName(clean.away)) clean.away = seed.away;

  const trustedKickoff = trustedKickoffUtcForLock(clean);
  if (trustedKickoff) clean.kickoff_utc = trustedKickoff;

  // Kui varasem halb API vaste on pannud tulevasele mängule skoori külge,
  // siis seda ei tohi avalikes vaadetes kasutada ega edasi bracketisse kanda.
  clean = stripPrematureWorldCupResultForDisplay(clean);

  return clean;
}

function stripUnsafeRepairedPlayoffResultForDisplay(original, repaired){
  // Kui play-off rea tiimid tuli avaliku vaate jaoks seed/bracket loogika järgi ümber parandada,
  // siis sama rea vana skoor võib pärineda valelt API fixture'ilt. Sellist skoori ei tohi
  // teiste ennustuste vaates ega edetabeli kuvamisel kasutada. Sync kirjutab õige fixture'i
  // järgi tulemuse uuesti peale.
  if (!original || !repaired || !isMainWorldCupPlayoffMatch(repaired)) return repaired;
  if (!matchHasUsableResult(repaired)) return repaired;
  if (repaired.manual_result_override || original.manual_result_override) return repaired;

  const originalHome = String(original.home || "").trim();
  const originalAway = String(original.away || "").trim();
  const repairedHome = String(repaired.home || "").trim();
  const repairedAway = String(repaired.away || "").trim();

  const homeChanged = originalHome && repairedHome && !teamNamesMatch(originalHome, repairedHome);
  const awayChanged = originalAway && repairedAway && !teamNamesMatch(originalAway, repairedAway);

  if (!homeChanged && !awayChanged) return repaired;

  return {
    ...repaired,
    final_home: null,
    final_away: null,
    winner: null,
    is_finished: false,
    went_extra: false,
    api_status_short: "",
    unsafe_result_hidden: true
  };
}

function sanitizeWorldCupMatchesForDisplay(matches){
  // Avalikud ennustusvaated ei tohi usaldada play-off ridade home/away väärtusi pimesi.
  // Varem võis halb API vaste kirjutada play-off reale päris, aga vale alagrupimängu nimed
  // näiteks Belgium - Egypt. Ennustused ise on seotud matches.id külge, seega kuvamiseks
  // taastame play-off tiimid alati ametliku seed-slot/bracket loogika järgi.
  const sourceById = new Map((matches || []).map(m => [m.id, m]));
  const baseCleaned = (matches || []).map(sanitizeWorldCupMatchForDisplay);
  const groupStandings = buildGroupStandingsFromMatches(baseCleaned);
  const byNo = new Map();

  const repairedSorted = baseCleaned
    .slice()
    .sort((a, b) => (Number(a?.match_no) || 0) - (Number(b?.match_no) || 0))
    .map(match => {
      const no = Number(match?.match_no);
      const seed = seedMatchByNoMap().get(no);
      let clean = { ...match };

      if (seed && Number.isFinite(no) && no >= 73 && no <= 104) {
        const officialActual = officialR32ActualFixtureForMatchNo(no);
        if (officialActual) {
          // Round of 32 tegelikud paarid tulevad ametlikust FIFA fixture'ist.
          // Ära tuleta neid enam vigaseks muutunud grupitabelist, sest see tekitas nt #83 Congo DR-Croatia ja #85 Canada-Algeria.
          clean.home = officialActual.home;
          clean.away = officialActual.away;
          clean.official_r32_actual_fixture = true;
        } else {
          clean.home = resolveSeededPlayoffSlotTeamName(seed.home, clean.home, byNo, groupStandings);
          clean.away = resolveSeededPlayoffSlotTeamName(seed.away, clean.away, byNo, groupStandings);
        }
        clean = stripUnsafeRepairedPlayoffResultForDisplay(sourceById.get(clean.id), clean);
      }

      byNo.set(no, clean);
      return clean;
    });

  const repairedById = new Map(repairedSorted.map(m => [m.id, m]));
  const repaired = baseCleaned.map(m => repairedById.get(m.id) || m);

  return repaired.filter(m => isVisiblePredictionMatchInContext(m, byNo));
}

function isApiRealTeamName(name){
  const raw = String(name || "").trim();
  const normalized = normalizeTeamName(raw);
  if (!raw || !normalized) return false;
  if (isPlaceholderTeam(raw)) return false;
  if (["tbd", "to be decided", "unknown", "undefined"].includes(normalized)) return false;
  return true;
}

function apiTeamPatchForMatch(match, fx){
  // Tiiminimede automaatne asendamine on vajalik ainult play-offis.
  // Ennustused on seotud matches.id külge, seega muudame ainult kodu/võõrsil nimevälju.
  if (!isPlayoffMatch(match)) return {};

  const officialActual = officialR32ActualFixtureForMatchNo(match?.match_no);
  if (officialActual) {
    const patch = {};
    if (!teamNamesMatch(match?.home, officialActual.home)) patch.home = officialActual.home;
    if (!teamNamesMatch(match?.away, officialActual.away)) patch.away = officialActual.away;
    if (Object.keys(patch).length) return patch;
  }

  const no = Number(match?.match_no);
  if (Number.isFinite(no) && no >= 89 && no <= 104) {
    // 1/8 finaalist alates tuletame nimed ainult ametliku W/L bracketi eelmiste mängude põhjal.
    // See takistab halval API vastel #91 vms tulevast mängu Brazil - Morocco tüüpi valeks muuta.
    return {};
  }

  const patch = {};
  const apiHome = fx?.teams?.home?.name;
  const apiAway = fx?.teams?.away?.name;

  const homeDisplay = isMainWorldCupMatch(match)
    ? worldCupCanonicalTeamName(apiHome)
    : String(apiHome || "").trim();
  const awayDisplay = isMainWorldCupMatch(match)
    ? worldCupCanonicalTeamName(apiAway)
    : String(apiAway || "").trim();

  if (isApiRealTeamName(apiHome) && homeDisplay && !teamNamesMatch(match?.home, homeDisplay)) {
    patch.home = homeDisplay;
  }

  if (isApiRealTeamName(apiAway) && awayDisplay && !teamNamesMatch(match?.away, awayDisplay)) {
    patch.away = awayDisplay;
  }

  return patch;
}

function apiKickoffPatchForMatch(match, fx){
  if (!isMainWorldCupMatch(match)) return {};

  const forcedPatch = forcedOfficialKickoffPatchForMatch(match);
  if (Object.keys(forcedPatch).length) return forcedPatch;
  if (officialKickoffOverrideUtcForMatch(match)) return {};

  if (!fixtureAllowedForMatch(match, fx)) return {};

  const rawDate = fx?.fixture?.date;
  if (!rawDate) return {};

  const apiTime = new Date(rawDate).getTime();
  if (!Number.isFinite(apiTime)) return {};

  const currentTime = match?.kickoff_utc ? new Date(match.kickoff_utc).getTime() : null;
  const diffMs = Number.isFinite(currentTime) ? Math.abs(currentTime - apiTime) : Number.POSITIVE_INFINITY;

  if (diffMs <= 60 * 1000) return {};

  return { kickoff_utc: new Date(apiTime).toISOString() };
}

function seedPlayoffMatchesForRound(roundKey){
  return SEED_MATCHES
    .filter(m => playoffRoundKeyFromMatch(m) === roundKey)
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.kickoff_utc).getTime();
      const tb = new Date(b.kickoff_utc).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return Number(a.match_no || 0) - Number(b.match_no || 0);
    });
}

function sortedPlayoffFixturesForRound(fixtures, roundKey, dbMatch = null){
  return (fixtures || [])
    .filter(fx => playoffRoundKeyFromFixture(fx) === roundKey)
    .filter(fx => !dbMatch || fixtureAllowedForMatch(dbMatch, fx))
    .slice()
    .sort((a, b) => {
      const ta = fixtureKickoffMs(a) ?? Number.MAX_SAFE_INTEGER;
      const tb = fixtureKickoffMs(b) ?? Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return Number(a?.fixture?.id || 0) - Number(b?.fixture?.id || 0);
    });
}

function fixtureHasAnyRealTeam(fx){
  return isApiRealTeamName(fx?.teams?.home?.name) || isApiRealTeamName(fx?.teams?.away?.name);
}

function choosePlayoffFixtureByRoundOrder(dbMatch, fixtures){
  const needsRepair = matchNeedsWorldCupTeamRepair(dbMatch);
  if (!isPlayoffMatch(dbMatch) || (!matchHasPlaceholderTeam(dbMatch) && !needsRepair)) return null;

  const roundKey = playoffRoundKeyFromMatch(dbMatch);
  if (!roundKey) return null;

  const candidates = sortedPlayoffFixturesForRound(fixtures, roundKey, dbMatch);
  if (!candidates.length) return null;

  const dbKick = dbMatch.kickoff_utc ? new Date(dbMatch.kickoff_utc).getTime() : null;
  if (Number.isFinite(dbKick)) {
    let nearest = null;
    let nearestDiff = Number.POSITIVE_INFINITY;
    for (const fx of candidates) {
      const fxKick = fixtureKickoffMs(fx);
      if (!Number.isFinite(fxKick)) continue;
      const diffMin = Math.abs(dbKick - fxKick) / 60000;
      if (diffMin < nearestDiff) {
        nearest = fx;
        nearestDiff = diffMin;
      }
    }

    // Play-offis ei ole tavaliselt samal ajal mitu mängu. Kui API aeg erineb mõne tunni,
    // lubame ikkagi vaste, et üksikud placeholderid ei jääks üles.
    if (nearest && nearestDiff <= 6 * 60) return nearest;
  }

  const localRoundMatches = seedPlayoffMatchesForRound(roundKey);
  const index = localRoundMatches.findIndex(m => Number(m.match_no) === Number(dbMatch.match_no));
  if (index >= 0 && candidates[index]) return candidates[index];

  if (candidates.length === 1) return candidates[0];
  return null;
}

function isMainWorldCupPlayoffMatch(match){
  const no = Number(match?.match_no);
  return isMainWorldCupMatch(match) && Number.isFinite(no) && no >= 73 && no <= 104;
}

function playoffFixtureMatchesTrustedKickoff(dbMatch, fx, toleranceMinutes = 150){
  if (!isMainWorldCupPlayoffMatch(dbMatch)) return false;

  const expectedRaw = trustedKickoffUtcForLock(dbMatch);
  const expected = expectedRaw ? new Date(expectedRaw).getTime() : null;
  const actual = fixtureKickoffMs(fx);
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return false;

  const diffMin = Math.abs(expected - actual) / 60000;
  if (diffMin > toleranceMinutes) return false;

  const dbRound = playoffRoundKeyFromMatch(dbMatch);
  const fxRound = playoffRoundKeyFromFixture(fx);
  if (dbRound && fxRound && dbRound !== fxRound) return false;

  return true;
}

function choosePlayoffFixtureByTrustedKickoff(dbMatch, fixtures){
  if (!isMainWorldCupPlayoffMatch(dbMatch)) return null;

  const expectedRaw = trustedKickoffUtcForLock(dbMatch);
  const expected = expectedRaw ? new Date(expectedRaw).getTime() : null;
  if (!Number.isFinite(expected)) return null;

  const candidates = (fixtures || [])
    .filter(fx => fixtureAllowedForMatch(dbMatch, fx))
    .filter(fx => playoffFixtureMatchesTrustedKickoff(dbMatch, fx))
    .map(fx => ({ fx, diff: Math.abs(expected - fixtureKickoffMs(fx)) }))
    .sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      return Number(a.fx?.fixture?.id || 0) - Number(b.fx?.fixture?.id || 0);
    });

  return candidates[0]?.fx || null;
}

function chooseFixtureForMatch(dbMatch, fixtures){
  const hasPlaceholder = matchHasPlaceholderTeam(dbMatch);
  const needsRepair = matchNeedsWorldCupTeamRepair(dbMatch);
  const allowTeamFallback = hasPlaceholder || needsRepair;

  if (isMainWorldCupPlayoffMatch(dbMatch)) {
    // Play-off vaste valitakse esmalt ametliku match_no seed-kellaaja järgi.
    // Vana api_football_fixture_id võib olla jäänud alagrupimängust külge
    // näiteks #77 France-Senegal või #82 Belgium-Egypt, seega seda ei tohi esimesena usaldada.
    const trustedPlayoffFixture = choosePlayoffFixtureByTrustedKickoff(dbMatch, fixtures);
    if (trustedPlayoffFixture) return trustedPlayoffFixture;
  }

  if (dbMatch.api_football_fixture_id){
    const exact = fixtures.find(fx => Number(fx?.fixture?.id) === Number(dbMatch.api_football_fixture_id));
    // MM mängude puhul ei kasuta kunagi muu liiga fixture'it, isegi kui vana fixture_id on varem valesti salvestunud.
    // Play-offis peab vana fixture_id lisaks klappima ametliku seed-kella ja ringiga.
    const exactAllowedByPlayoffTime = !isMainWorldCupPlayoffMatch(dbMatch) || playoffFixtureMatchesTrustedKickoff(dbMatch, exact);
    if (exact && exactAllowedByPlayoffTime && fixtureAllowedForMatch(dbMatch, exact) && (allowTeamFallback || fixtureHasTeamNameOverlap(dbMatch, exact))) return exact;
  }

  let best = null;
  let bestScore = -1;
  let bestHasOverlap = false;

  for (const fx of fixtures){
    if (!fixtureAllowedForMatch(dbMatch, fx)) continue;

    const hasOverlap = fixtureHasTeamNameOverlap(dbMatch, fx);

    // Alagrupi ja päris tiimidega mängude puhul peab tiiminimi klappima.
    // Placeholderi või vigase U20/muu liigast tulnud nime puhul lubame MM fixture'i järgi parandust.
    if (!hasOverlap && !allowTeamFallback) continue;

    const score = scoreFixtureMatch(dbMatch, fx);
    if (score > bestScore){
      best = fx;
      bestScore = score;
      bestHasOverlap = hasOverlap;
    }
  }

  if (bestHasOverlap && bestScore >= 4) return best;
  if (allowTeamFallback && bestScore >= 6) return best;

  const orderFallback = choosePlayoffFixtureByRoundOrder(dbMatch, fixtures);
  if (orderFallback) return orderFallback;

  return null;
}


function dateOnlyInTimeZone(value, timeZone = "UTC"){
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);

  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function isoDateOnly(value){
  return dateOnlyInTimeZone(value, "UTC");
}

function apiFootballDateOnly(value){
  return dateOnlyInTimeZone(value, "Europe/Tallinn");
}

function uniqueList(items){
  return Array.from(new Set((items || []).filter(Boolean)));
}



async function discoverApiFootballLeagueSources(apiKey, search, season){
  const found = [];
  const url = `${API_FOOTBALL_BASE_URL}/leagues?search=${encodeURIComponent(search)}`;

  try{
    const resp = await fetchApiFootball(url, {
      headers: {
        "x-apisports-key": apiKey,
        "Accept": "application/json"
      }
    });

    if (!resp.ok) return found;

    const data = await resp.json();
    const rows = Array.isArray(data?.response) ? data.response : [];

    for (const row of rows){
      const leagueName = String(row?.league?.name || "").toLowerCase();
      const leagueId = Number(row?.league?.id);
      if (!leagueId) continue;

      if (!leagueName.includes(String(search || "").toLowerCase())) continue;

      const seasons = Array.isArray(row?.seasons) ? row.seasons : [];
      if (seasons.some(s => Number(s?.year) === Number(season))) {
        found.push({ league: leagueId, season });
      }
    }
  }catch(_){
    return found;
  }

  return found;
}

async function fetchApiFootballFixtures(matchDates = []){
  const apiKey = process.env.API_FOOTBALL_KEY || "";
  if (!apiKey) return { ok:false, error:"API_FOOTBALL_KEY puudu", fixtures:[] };

  const sources = [
    { league: API_FOOTBALL_LEAGUE_ID, season: API_FOOTBALL_SEASON },
    ...API_FOOTBALL_EXTRA_LEAGUES
  ];

  const discoveredBaltic = await discoverApiFootballLeagueSources(apiKey, "Baltic Cup", 2026);
  for (const src of discoveredBaltic){
    if (!sources.some(s => Number(s.league) === Number(src.league) && Number(s.season) === Number(src.season))) {
      sources.push(src);
    }
  }

  const allFixtures = [];
  const errors = [];
  const requested = [];
  const seenFixtureIds = new Set();

  async function addFixturesFromUrl(url, label){
    requested.push(label);

    let resp;
    try{
      resp = await fetchApiFootball(url, {
        headers: {
          "x-apisports-key": apiKey,
          "Accept": "application/json"
        }
      });
    }catch(err){
      errors.push(`${label}: ${apiFootballFetchErrorMessage(err)}`);
      return;
    }

    if (!resp.ok){
      const txt = await resp.text().catch(() => "");
      errors.push(`${label}: HTTP ${resp.status} ${txt.slice(0,180)}`);
      return;
    }

    const data = await resp.json();

    const apiErrors = data?.errors;
    if (apiErrors && (
      (Array.isArray(apiErrors) && apiErrors.length) ||
      (!Array.isArray(apiErrors) && Object.keys(apiErrors).length)
    )) {
      errors.push(`${label}: ${JSON.stringify(apiErrors).slice(0,240)}`);
    }

    if (Array.isArray(data?.response)) {
      for (const fx of data.response) {
        const id = Number(fx?.fixture?.id);
        if (id && seenFixtureIds.has(id)) continue;
        if (id) seenFixtureIds.add(id);
        allFixtures.push(fx);
      }
    }
  }

  for (const src of sources){
    await addFixturesFromUrl(
      `${API_FOOTBALL_BASE_URL}/fixtures?league=${src.league}&season=${src.season}`,
      `league ${src.league} season ${src.season}`
    );
  }

  for (const date of uniqueList(matchDates).slice(0, 10)){
    await addFixturesFromUrl(
      `${API_FOOTBALL_BASE_URL}/fixtures?date=${date}&timezone=Europe/Tallinn`,
      `date ${date}`
    );
  }

  if (!allFixtures.length && errors.length){
    return { ok:false, error:`API-Football viga: ${errors.join("; ")}`, fixtures:[], requested };
  }

  return { ok:true, fixtures: allFixtures, errors, requested };
}


function parseManualResultLine(line){
  const raw = String(line || "").trim();
  if (!raw || raw.startsWith("#")) return null;

  const cleaned = raw
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const m = cleaned.match(/^#?(-?\d+)\s+(\d+)\s*[:\-]\s*(\d+)(?:\s+(home|away|kodu|võõrsil|voorsil))?$/i)
    || cleaned.match(/^#?(-?\d+)\s+(\d+)\s+(\d+)(?:\s+(home|away|kodu|võõrsil|voorsil))?$/i);

  if (!m) return { error: `Vigane rida: ${raw}` };

  const match_no = Number(m[1]);
  const final_home = Number(m[2]);
  const final_away = Number(m[3]);
  let winner = String(m[4] || "").toLowerCase();

  if (winner === "kodu") winner = "home";
  if (winner === "võõrsil" || winner === "voorsil") winner = "away";
  if (winner && !["home", "away"].includes(winner)) winner = "";

  if (!Number.isFinite(match_no) || !Number.isFinite(final_home) || !Number.isFinite(final_away)) {
    return { error: `Vigased numbrid: ${raw}` };
  }

  return { match_no, final_home, final_away, winner };
}


function getMatchAdvancement(match){
  if (!match) return null;

  // Päris MM bracketis ei tohi W/L kohti tuletada mängust, mille tiimid on veel placeholderid
  // või mille nimed on varasema vale API vaste tõttu rikutud.
  if (isMainWorldCupMatch(match) && (matchHasUnresolvedTeamSlot(match) || matchNeedsWorldCupTeamRepair(match))) {
    return null;
  }

  const fh = match.final_home;
  const fa = match.final_away;
  if (fh === null || fa === null || fh === undefined || fa === undefined) return null;

  let winner = normalizeWinner(match.winner);
  if (!winner && Number(fh) !== Number(fa)) {
    winner = Number(fh) > Number(fa) ? "home" : "away";
  }

  if (!winner) return null;

  const loser = winner === "home" ? "away" : "home";

  return {
    winner,
    loser,
    winnerName: winner === "home" ? match.home : match.away,
    loserName: loser === "home" ? match.home : match.away
  };
}

function resolvePlaceholderTeamName(value, byMatchNo){
  const token = String(value || "").trim();
  const m = token.match(/^([WL])(-?\d+)$/i);
  if (!m) return null;

  const type = m[1].toUpperCase();
  const refNo = Number(m[2]);
  const refMatch = byMatchNo.get(refNo);
  const adv = getMatchAdvancement(refMatch);
  if (!adv) return null;

  return type === "W" ? adv.winnerName : adv.loserName;
}

function groupLetterFromStage(stage){
  const m = String(stage || "").trim().match(/group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : "";
}

function ensureStandingTeam(map, team){
  const name = String(team || "").trim();
  if (!name || isPlaceholderTeam(name)) return null;
  const key = normalizeTeamName(name);
  if (!key) return null;
  if (!map.has(key)) {
    map.set(key, { team: name, played: 0, points: 0, gf: 0, ga: 0, gd: 0 });
  }
  return map.get(key);
}

function buildGroupStandingsFromMatches(matches){
  const groups = new Map();

  for (const match of matches || []) {
    const no = Number(match?.match_no);
    if (!Number.isFinite(no) || no < 1 || no > 72) continue;

    const group = groupLetterFromStage(match?.stage);
    if (!group) continue;

    if (!groups.has(group)) groups.set(group, { teams: new Map(), finished: 0, ranked: [], complete: false });
    const g = groups.get(group);

    const homeRow = ensureStandingTeam(g.teams, match.home);
    const awayRow = ensureStandingTeam(g.teams, match.away);
    if (!homeRow || !awayRow) continue;

    const fhRaw = match.final_home;
    const faRaw = match.final_away;
    const hasScore = fhRaw !== null && fhRaw !== undefined && faRaw !== null && faRaw !== undefined;
    if (!hasScore) continue;

    const fh = Number(fhRaw);
    const fa = Number(faRaw);
    if (!Number.isFinite(fh) || !Number.isFinite(fa)) continue;

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.gf += fh;
    homeRow.ga += fa;
    awayRow.gf += fa;
    awayRow.ga += fh;
    homeRow.gd = homeRow.gf - homeRow.ga;
    awayRow.gd = awayRow.gf - awayRow.ga;

    if (fh > fa) homeRow.points += 3;
    else if (fh < fa) awayRow.points += 3;
    else {
      homeRow.points += 1;
      awayRow.points += 1;
    }

    g.finished += 1;
  }

  for (const g of groups.values()) {
    g.ranked = Array.from(g.teams.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return String(a.team).localeCompare(String(b.team), "et");
    });
    g.complete = g.finished >= 6 && g.ranked.length >= 4;
  }

  return groups;
}

function bestThirdPlaceGroups(groupStandings){
  return Array.from(groupStandings.entries())
    .filter(([, g]) => g.complete && g.ranked[2])
    .map(([group, g]) => ({ group, team: g.ranked[2].team, row: g.ranked[2] }))
    .sort((a, b) => {
      if (b.row.points !== a.row.points) return b.row.points - a.row.points;
      if (b.row.gd !== a.row.gd) return b.row.gd - a.row.gd;
      if (b.row.gf !== a.row.gf) return b.row.gf - a.row.gf;
      return String(a.group).localeCompare(String(b.group));
    })
    .slice(0, 8);
}

function resolveGroupSlotTeamName(value, groupStandings){
  const token = String(value || "").trim().toUpperCase();

  const direct = token.match(/^([12])([A-L])$/);
  if (direct) {
    const pos = Number(direct[1]);
    const group = direct[2];
    const standing = groupStandings.get(group);
    if (standing?.complete && standing.ranked[pos - 1]?.team) return standing.ranked[pos - 1].team;
    return null;
  }

  const third = token.match(/^3([A-L]+)$/);
  if (third) {
    const allowed = new Set(third[1].split(""));
    const matches = bestThirdPlaceGroups(groupStandings).filter(item => allowed.has(item.group));

    // Kolmanda koha keerulisi kohti täidame ainult siis, kui antud placeholderile sobib üheselt üks grupp.
    // Kui valikuid on mitu, jätame API-Footballi või käsitsi kinnituse otsustada.
    if (matches.length === 1) return matches[0].team;
  }

  return null;
}

function groupStandingRankForTeam(team, groupStandings){
  const raw = String(team || "").trim();
  if (!raw) return null;

  for (const [group, standing] of groupStandings.entries()) {
    if (!standing?.complete) continue;
    for (let i = 0; i < (standing.ranked || []).length; i += 1) {
      const row = standing.ranked[i];
      if (row?.team && teamNamesMatch(row.team, raw)) {
        return { group, pos: i + 1, team: row.team };
      }
    }
  }

  return null;
}

function groupSlotAllowsCurrentTeam(slot, currentTeam, groupStandings){
  const token = String(slot || "").trim().toUpperCase();
  const team = String(currentTeam || "").trim();
  if (!token || !team || isPlaceholderTeam(team)) return false;

  const direct = token.match(/^([12])([A-L])$/);
  if (direct) {
    const pos = Number(direct[1]);
    const group = direct[2];
    const standing = groupStandings.get(group);
    const expected = standing?.complete ? standing.ranked?.[pos - 1]?.team : null;
    return !!expected && teamNamesMatch(expected, team);
  }

  const third = token.match(/^3([A-L]+)$/);
  if (third) {
    const allowed = new Set(third[1].split(""));
    const rank = groupStandingRankForTeam(team, groupStandings);
    if (!rank || rank.pos !== 3 || !allowed.has(rank.group)) return false;

    // 3ABC... sloti tohib täita ainult turniiri tegeliku parima kolmanda koha tiimiga.
    // See väldib olukorda, kus vale API vaste paneb play-off reale suvalise sama MM-i tiimi
    // nagu näiteks alagrupimängu Belgium - Egypt.
    return bestThirdPlaceGroups(groupStandings).some(item =>
      item.group === rank.group && item.team && teamNamesMatch(item.team, team)
    );
  }

  return false;
}

function resolveSeededPlayoffSlotTeamName(slot, currentTeam, byMatchNo, groupStandings){
  const token = String(slot || "").trim();
  if (!token) return String(currentTeam || "").trim();

  const resolved = resolvePlaceholderTeamName(token, byMatchNo) || resolveGroupSlotTeamName(token, groupStandings);
  if (resolved) return resolved;

  // Kui andmebaasis on juba päris tiiminimi ja see sobib täpselt selle seed-slotiga,
  // võib selle alles jätta. Kui ei sobi, läheme tagasi placeholderi peale ja avalik vaade peidab mängu.
  if (groupSlotAllowsCurrentTeam(token, currentTeam, groupStandings)) {
    return String(currentTeam || "").trim();
  }

  return token;
}

function resolveAnyPlayoffPlaceholderTeamName(value, byMatchNo, groupStandings){
  return resolvePlaceholderTeamName(value, byMatchNo) || resolveGroupSlotTeamName(value, groupStandings);
}


function normalizeScheduleText(value){
  return String(value ?? "").trim();
}

function normalizeScheduleTime(value){
  if (!value) return "";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : "";
}

function seedMatchByNoMap(){
  return new Map(SEED_MATCHES.map(m => [Number(m.match_no), m]));
}

function compareMatchToSeed(row, seed){
  const diffs = [];
  const fields = [
    ["stage", "Alagrupp/faas"],
    ["home", "Kodumeeskond"],
    ["away", "Võõrsil"],
    ["location", "Asukoht"]
  ];

  for (const [field, label] of fields) {
    if (normalizeScheduleText(row?.[field]) !== normalizeScheduleText(seed?.[field])) {
      diffs.push({ field, label, current: row?.[field] ?? "", expected: seed?.[field] ?? "" });
    }
  }

  if (normalizeScheduleTime(row?.kickoff_utc) !== normalizeScheduleTime(seed?.kickoff_utc)) {
    diffs.push({ field: "kickoff_utc", label: "Algusaeg", current: row?.kickoff_utc ?? "", expected: seed?.kickoff_utc ?? "" });
  }

  return diffs;
}

async function getScheduleDiffs(sb){
  const current = await sb
    .from("matches")
    .select("id,match_no,stage,home,away,kickoff_utc,location")
    .gte("match_no", 1)
    .lte("match_no", 104)
    .order("match_no", { ascending: true });

  if (current.error) throw new Error(current.error.message);

  const currentByNo = new Map((current.data || []).map(m => [Number(m.match_no), m]));
  const diffs = [];
  const missing = [];

  for (const seed of SEED_MATCHES) {
    const no = Number(seed.match_no);
    if (!Number.isFinite(no) || no < 1 || no > 104) continue;

    const row = currentByNo.get(no);
    if (!row) {
      missing.push({
        match_no: no,
        expected: {
          stage: seed.stage,
          home: seed.home,
          away: seed.away,
          kickoff_utc: seed.kickoff_utc,
          location: seed.location
        }
      });
      continue;
    }

    const rowDiffs = compareMatchToSeed(row, seed);
    if (rowDiffs.length) {
      diffs.push({
        id: row.id,
        match_no: no,
        current: {
          stage: row.stage,
          home: row.home,
          away: row.away,
          kickoff_utc: row.kickoff_utc,
          location: row.location
        },
        expected: {
          stage: seed.stage,
          home: seed.home,
          away: seed.away,
          kickoff_utc: seed.kickoff_utc,
          location: seed.location
        },
        diffs: rowDiffs
      });
    }
  }

  return {
    total_seed: SEED_MATCHES.filter(m => Number(m.match_no) >= 1 && Number(m.match_no) <= 104).length,
    total_existing: current.data?.length || 0,
    diff_count: diffs.length,
    missing_count: missing.length,
    diffs,
    missing
  };
}

async function fixScheduleFromSeed(sb){
  const before = await getScheduleDiffs(sb);
  const seedByNo = seedMatchByNoMap();
  const updated = [];
  const errors = [];

  for (const item of before.diffs) {
    const seed = seedByNo.get(Number(item.match_no));
    if (!seed) continue;

    const patch = {
      stage: seed.stage,
      home: seed.home,
      away: seed.away,
      kickoff_utc: seed.kickoff_utc,
      location: seed.location
    };

    const upd = await sb
      .from("matches")
      .update(patch)
      .eq("id", item.id)
      .select("id,match_no,stage,home,away,kickoff_utc,location")
      .single();

    if (upd.error) errors.push(`#${item.match_no}: ${upd.error.message}`);
    else updated.push(upd.data);
  }

  return {
    checked: before.total_existing,
    diff_count_before: before.diff_count,
    missing_count: before.missing_count,
    updated_count: updated.length,
    error_count: errors.length,
    updated,
    errors,
    missing: before.missing
  };
}


async function updateDerivedPlayoffMatches(sb){
  const matchesRes = await sb
    .from("matches")
    .select("id,match_no,stage,home,away,final_home,final_away,winner,is_finished")
    .order("match_no", { ascending: true });

  if (matchesRes.error) return { updated: 0, error: matchesRes.error.message };

  const matches = matchesRes.data || [];
  const byNo = new Map(matches.map(m => [Number(m.match_no), m]));
  const groupStandings = buildGroupStandingsFromMatches(matches);
  const updates = [];

  for (const match of matches){
    let home = match.home;
    let away = match.away;

    const seed = seedMatchByNoMap().get(Number(match.match_no));
    const no = Number(match.match_no);

    if (seed && no >= 73 && no <= 104) {
      const officialActual = officialR32ActualFixtureForMatchNo(no);
      if (officialActual) {
        // Round of 32 tegelikud paarid on nüüd teada. Kirjutame need DB reale,
        // mitte ei tuleta neid võimalikust rikutud grupitabelist.
        home = officialActual.home;
        away = officialActual.away;
      } else {
        // Hilisemad play-off read tuletame W/L bracketi põhjal.
        home = resolveSeededPlayoffSlotTeamName(seed.home, home, byNo, groupStandings);
        away = resolveSeededPlayoffSlotTeamName(seed.away, away, byNo, groupStandings);
      }
    } else if (seed) {
      if (String(home || "").trim() && !isExpectedWorldCupTeamName(home)) home = seed.home;
      if (String(away || "").trim() && !isExpectedWorldCupTeamName(away)) away = seed.away;
    }

    // U17 testfinaal: võitjad poolfinaalidest -3 ja -2.
    if (Number(match.match_no) === -1) {
      const semi1 = getMatchAdvancement(byNo.get(-3));
      const semi2 = getMatchAdvancement(byNo.get(-2));

      if (semi1?.winnerName) home = semi1.winnerName;
      if (semi2?.winnerName) away = semi2.winnerName;
    }

    // Baltic Cup testturniir: 3. koht kaotajad, finaal võitjad.
    if (Number(match.match_no) === -21) {
      const semi1 = getMatchAdvancement(byNo.get(-23));
      const semi2 = getMatchAdvancement(byNo.get(-22));

      if (semi1?.loserName) home = semi1.loserName;
      if (semi2?.loserName) away = semi2.loserName;
    }

    if (Number(match.match_no) === -20) {
      const semi1 = getMatchAdvancement(byNo.get(-23));
      const semi2 = getMatchAdvancement(byNo.get(-22));

      if (semi1?.winnerName) home = semi1.winnerName;
      if (semi2?.winnerName) away = semi2.winnerName;
    }

    byNo.set(Number(match.match_no), { ...match, home, away });

    if (home !== match.home || away !== match.away) {
      const upd = await sb
        .from("matches")
        .update({ home, away })
        .eq("id", match.id)
        .select("id,match_no,home,away")
        .single();

      if (!upd.error) updates.push(upd.data);
    }
  }

  return { updated: updates.length, matches: updates };
}


function shouldClearUnresolvedWorldCupResult(match, byNo = null){
  if (!isMainWorldCupMatch(match)) return false;

  // Tulevase mängu küljes olev skoor/tulemus on alati varasema vale sync'i jääk,
  // välja arvatud juhul, kui admin on tulemuse käsitsi override'inud.
  if (isPrematureWorldCupResult(match)) return true;

  const sanitized = sanitizeWorldCupMatchForDisplay(match);
  const unresolvedOrRepair = matchNeedsWorldCupTeamRepair(match) || matchHasUnresolvedTeamSlot(sanitized);
  const badResolvedKnockout = byNo ? isInvalidResolvedKnockoutMatch(sanitized, byNo) : false;
  if (!unresolvedOrRepair && !badResolvedKnockout) return false;

  return worldCupMatchHasStoredResultFields(match);
}

async function clearUnresolvedWorldCupResults(sb, matches = null){
  const source = matches || (await sb
    .from("matches")
    .select("id,match_no,stage,home,away,kickoff_utc,final_home,final_away,winner,is_finished,went_extra,api_status_short,manual_result_override")
    .order("match_no", { ascending: true })).data || [];

  const cleanedSource = (source || []).map(sanitizeWorldCupMatchForDisplay);
  const byNo = new Map(cleanedSource.map(m => [Number(m.match_no), m]));
  const toClear = (source || []).filter(m => shouldClearUnresolvedWorldCupResult(m, byNo));
  let cleared_matches = 0;
  let reset_predictions = 0;
  const examples = [];
  const errors = [];

  for (const match of toClear) {
    const patch = {
      final_home: null,
      final_away: null,
      winner: null,
      is_finished: false,
      went_extra: false,
      api_status_short: "",
      manual_result_override: false
    };

    const upd = await sb.from("matches").update(patch).eq("id", match.id);
    if (upd.error) {
      errors.push(`#${match.match_no}: ${upd.error.message}`);
      continue;
    }

    cleared_matches += 1;
    if (examples.length < 20) examples.push(`#${match.match_no} ${match.home} - ${match.away}`);

    const predUpd = await sb.from("predictions").update({ points: 0 }).eq("match_id", match.id);
    if (predUpd.error) errors.push(`#${match.match_no} punktid: ${predUpd.error.message}`);
    else reset_predictions += 1;
  }

  return {
    cleared_matches,
    reset_predictions,
    examples,
    errors,
    error_count: errors.length
  };
}

async function recalcPointsForMatch(sb, matchId){
  const matchRes = await sb.from("matches").select("*").eq("id", matchId).single();
  if (matchRes.error || !matchRes.data) {
    return { updated_predictions: 0, skipped: true, error: matchRes.error?.message || "Mängu ei leitud." };
  }

  const match = matchRes.data;

  // Turvakaitse: tulevase MM mängu küljes olev skoor ei tohi kunagi punkte anda.
  // See ei muuda õigete lõppenud mängude punkte, vaid nullib ainult varasema vale sync/testi jäägi.
  if (isPrematureWorldCupResult(match)) {
    const predReset = await sb.from("predictions").update({ points: 0 }, { count: "exact" }).eq("match_id", matchId);
    return {
      updated_predictions: 0,
      reset_predictions: predReset.error ? 0 : (predReset.count || 0),
      skipped: true,
      reason: "Tulevase mängu tulemust ei arvestata punktidesse.",
      error: predReset.error?.message || null
    };
  }

  const fh = match.final_home;
  const fa = match.final_away;
  if (fh===null || fa===null || fh===undefined || fa===undefined) {
    return { updated_predictions: 0, skipped: true, reason: "Tulemus puudub." };
  }

  const inferredWentExtra = inferWentExtraFromResult(match, fh, fa, match.winner);
  if (inferredWentExtra && !truthyDbBool(match.went_extra)) {
    const extraUpd = await sb.from("matches").update({ went_extra: true }).eq("id", matchId).select("went_extra").single();
    if (!extraUpd.error) match.went_extra = true;
  }

  const preds = await sb.from("predictions").select("id,pred_home,pred_away,pred_winner").eq("match_id", matchId);
  if (preds.error) {
    return { updated_predictions: 0, skipped: false, error: preds.error.message };
  }

  let updated_predictions = 0;
  let error_count = 0;
  const errors = [];

  for (const p of preds.data || []){
    const pts = calcPoints(p.pred_home, p.pred_away, fh, fa, {
      match,
      pred_winner: p.pred_winner
    });
    const upd = await sb.from("predictions").update({ points: pts }).eq("id", p.id);
    if (upd.error) {
      error_count += 1;
      if (errors.length < 5) errors.push(upd.error.message);
    } else {
      updated_predictions += 1;
    }
  }

  return {
    updated_predictions,
    checked_predictions: (preds.data || []).length,
    skipped: false,
    error_count,
    errors
  };
}

async function syncApiFootballResults(sb, { force=false } = {}){
  const now = Date.now();
  if (!force && now - lastApiFootballSyncAt < API_FOOTBALL_SYNC_COOLDOWN_MS){
    return { ok:true, skipped:true, updated:0, reason:"cooldown" };
  }
  lastApiFootballSyncAt = now;

  let matchesRes = await sb.from("matches").select("*").order("match_no", { ascending: true });
  if (matchesRes.error){
    return { ok:false, updated:0, error:matchesRes.error.message };
  }

  const cleanupBefore = await clearUnresolvedWorldCupResults(sb, matchesRes.data || []);
  if (cleanupBefore.cleared_matches > 0) {
    matchesRes = await sb.from("matches").select("*").order("match_no", { ascending: true });
    if (matchesRes.error){
      return { ok:false, updated:0, error:matchesRes.error.message };
    }
  }

  const matchDates = (matchesRes.data || [])
    .filter(m => !m.manual_result_override)
    .filter(m => {
      const trustedKickoff = trustedKickoffUtcForLock(m) || m.kickoff_utc;
      if (!trustedKickoff) return false;
      const t = new Date(trustedKickoff).getTime();
      return Number.isFinite(t) && t <= Date.now() + 24 * 60 * 60 * 1000;
    })
    .map(m => apiFootballDateOnly(trustedKickoffUtcForLock(m) || m.kickoff_utc));

  const fetched = await fetchApiFootballFixtures(matchDates);
  if (!fetched.ok){
    return { ok:false, updated:0, error:fetched.error || "API-Football päring ebaõnnestus" };
  }

  const fixtures = fetched.fixtures || [];
  const initialDisplayGuardMatches = (matchesRes.data || []).map(sanitizeWorldCupMatchForDisplay);
  const initialDisplayGuardByNo = new Map(initialDisplayGuardMatches.map(m => [Number(m.match_no), m]));
  let updated = 0;
  let matched = 0;
  let finished_found = 0;
  let skipped_manual = 0;
  let skipped_locked_group_results = 0;
  let update_errors = 0;
  let updated_playoff_teams = 0;
  const unmatched = [];
  const fixture_id_mismatches = [];
  const updated_matches = [];
  const updated_playoff_team_matches = [];
  const update_error_examples = [];

  for (const rawMatch of matchesRes.data || []){
    let match = { ...rawMatch };
    const hasManualResultOverride = !!match.manual_result_override;

    const forcedKickoffPatch = forcedOfficialKickoffPatchForMatch(match);
    if (Object.keys(forcedKickoffPatch).length) {
      const forcedUpd = await sb
        .from("matches")
        .update(forcedKickoffPatch)
        .eq("id", match.id)
        .select("id,match_no,home,away,kickoff_utc")
        .single();

      if (!forcedUpd.error) {
        match = { ...match, ...forcedUpd.data };
        updated_playoff_team_matches.push(`#${match.match_no} ametlik aeg ${match.kickoff_utc}`);
      } else {
        update_errors += 1;
        update_error_examples.push(`#${match.match_no} ametlik aeg: ${forcedUpd.error.message}`);
      }
    }

    if (hasManualResultOverride) {
      skipped_manual += 1;
    }

    if (isFinishedGroupStageScoreLocked(match)) {
      // Kaitse: group stage on läbi ja tulemus juba olemas.
      // Ära lase API-Footballil hiljem final_home/final_away väärtusi ega kasutajate punkte muuta.
      skipped_locked_group_results += 1;
      continue;
    }

    const no = Number(match.match_no);
    const hiddenFutureKnockout = Number.isFinite(no) && no >= 89 && no <= 104 && !isVisiblePredictionMatchInContext(
      sanitizeWorldCupMatchForDisplay(match),
      initialDisplayGuardByNo
    );

    if (hiddenFutureKnockout) {
      // Ära lase API-l lahendamata või valesti lahendatud järgmise ringi mängule tiime/skoori külge panna.
      // updateDerivedPlayoffMatches paneb W/L kohad õigeks siis, kui eelmiste mängude võitjad/kaotajad on teada.
      continue;
    }

    if (match.api_football_fixture_id) {
      const exactFixture = fixtures.find(fx => Number(fx?.fixture?.id) === Number(match.api_football_fixture_id));
      if (exactFixture && !matchHasPlaceholderTeam(match) && !fixtureHasTeamNameOverlap(match, exactFixture)) {
        fixture_id_mismatches.push(`#${match.match_no} ${match.home} - ${match.away}: olemasolev fixture ${fixtureDisplayName(exactFixture)} ei klapi tiiminimega`);
      }
    }

    const fx = chooseFixtureForMatch(match, fixtures);
    if (!fx) {
      const t = match.kickoff_utc ? new Date(match.kickoff_utc).getTime() : null;
      if (Number.isFinite(t) && t <= Date.now()) {
        unmatched.push(`#${match.match_no} ${match.home} - ${match.away}`);
      }
      continue;
    }

    matched += 1;

    // Optional fixture-id salvestus eraldi. Kui veerg puudub, ei tohi see skoori salvestamist katki teha.
    const fxId = Number(fx?.fixture?.id);
    if (fxId && Number(match.api_football_fixture_id) !== fxId){
      try {
        const fxUpd = await sb.from("matches").update({ api_football_fixture_id: fxId }).eq("id", match.id);
        // Kui api_football_fixture_id veerg puudub, võib Supabase tagastada errori.
        // See ei tohi skoori salvestamist peatada.
        void fxUpd;
        match.api_football_fixture_id = fxId;
      } catch (_) {
        // ignoreeri vabatahtliku veeru salvestuse viga
      }
    }

    const teamPatch = apiTeamPatchForMatch(match, fx);
    const kickoffPatch = apiKickoffPatchForMatch(match, fx);
    const matchMetaPatch = { ...teamPatch, ...kickoffPatch };
    if (Object.keys(matchMetaPatch).length) {
      const teamUpd = await sb
        .from("matches")
        .update(matchMetaPatch)
        .eq("id", match.id)
        .select("id,match_no,home,away,kickoff_utc")
        .single();

      if (!teamUpd.error) {
        if (Object.keys(teamPatch).length) updated_playoff_teams += 1;
        match = { ...match, ...teamUpd.data };
        const changedParts = [];
        if (Object.keys(teamPatch).length) changedParts.push(`${match.home} - ${match.away}`);
        if (Object.keys(kickoffPatch).length) changedParts.push(`aeg ${match.kickoff_utc}`);
        updated_playoff_team_matches.push(`#${match.match_no} ${changedParts.join(", ")}`);
      } else {
        update_errors += 1;
        update_error_examples.push(`#${match.match_no} tiimid/aeg: ${teamUpd.error.message}`);
      }
    }

    if (hasManualResultOverride) {
      continue;
    }

    if (apiFixtureFinished(fx)){
      finished_found += 1;

      const score = apiNormalTimeScore(fx);
      if (score && Number.isFinite(score.home) && Number.isFinite(score.away)){
        const homeGoals = score.home;
        const awayGoals = score.away;
        const apiWinner = apiFixtureWinner(fx);
        const statusShort = apiStatusShort(fx);
        const wentExtra = apiFixtureWentExtra(fx);

        const changed =
          Number(match.final_home) !== homeGoals ||
          Number(match.final_away) !== awayGoals ||
          normalizeWinner(match.winner) !== apiWinner ||
          String(match.api_status_short || "") !== statusShort ||
          truthyDbBool(match.went_extra) !== wentExtra ||
          !match.is_finished;

        const resultPatch = {
          final_home: homeGoals,
          final_away: awayGoals,
          is_finished: true,
          api_status_short: statusShort,
          went_extra: wentExtra
        };
        if (apiWinner) resultPatch.winner = apiWinner;

        const runningGoalScore = apiPlayingTimeScoreWithoutPenalties(fx);

        const upd = await sb.from("matches").update(resultPatch).eq("id", match.id).select("*").single();

        if (!upd.error){
          if (runningGoalScore && Number.isFinite(runningGoalScore.home) && Number.isFinite(runningGoalScore.away)) {
            // Vabatahtlikud veerud jooksu eesmärgi jaoks. Kui SQL migratsioon on veel käivitamata, ei katkesta sync'i.
            try {
              await sb
                .from("matches")
                .update({ goals_home_120: runningGoalScore.home, goals_away_120: runningGoalScore.away })
                .eq("id", match.id);
            } catch (_) {}
          }

          updated += 1;
          const runningGoalText = runningGoalScore && (runningGoalScore.home !== homeGoals || runningGoalScore.away !== awayGoals)
            ? `, jooks ${runningGoalScore.home}:${runningGoalScore.away}`
            : "";
          updated_matches.push(`#${match.match_no} ${match.home} - ${match.away} ${homeGoals}:${awayGoals}${wentExtra ? " lisa/pen" : ""}${runningGoalText}`);
          if (changed){
            await recalcPointsForMatch(sb, match.id);
          }
        } else {
          update_errors += 1;
          update_error_examples.push(`#${match.match_no} ${upd.error.message}`);
        }
      }
    }
  }

  const cleanupAfter = await clearUnresolvedWorldCupResults(sb);
  const derived = await updateDerivedPlayoffMatches(sb);

  return {
    ok:true,
    updated,
    fixtures: fixtures.length,
    matched,
    finished_found,
    skipped_manual,
    skipped_locked_group_results,
    update_errors,
    updated_playoff_teams,
    cleanup_before: cleanupBefore,
    cleanup_after: cleanupAfter,
    derived_updates: derived.updated || 0,
    requested: fetched.requested || [],
    updated_matches: updated_matches.slice(0, 20),
    updated_playoff_team_matches: updated_playoff_team_matches.slice(0, 20),
    unmatched: unmatched.slice(0, 20),
    fixture_id_mismatches: fixture_id_mismatches.slice(0, 20),
    update_error_examples: update_error_examples.slice(0, 10),
    api_errors: fetched.errors || []
  };
}

validateRequiredEnv();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

function makeEvent(req) {
  return {
    httpMethod: req.method,
    path: req.path,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? null : JSON.stringify(req.body || {}),
    queryStringParameters: req.query || {}
  };
}

async function netlifyHandler(event) {

  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

    const route = parseRoute(event);

    if (event.httpMethod === "GET" && route === "rules") {
      const sb = sbAdmin();
      const rules = await getRulesText(sb);
      return json(200, { ok: true, text: rules.text, settings_available: rules.settings_available !== false, settings_error: rules.settings_error || null });
    }

    const sb = sbAdmin();

    if (event.httpMethod === "POST" && route === "admin/rules") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      const body = JSON.parse(event.body || "{}");
      const text = String(body.text || "").trim();

      if (!text) return json(400, { error: "Reeglite tekst ei tohi olla tühi." });
      if (text.length > 30000) return json(400, { error: "Reeglite tekst on liiga pikk." });

      const upd = await sb
        .from("app_settings")
        .upsert({
          key: "rules_text",
          value: text,
          updated_at: new Date().toISOString()
        }, { onConflict: "key" })
        .select("key,value")
        .single();

      if (upd.error) {
        return json(500, { error: upd.error.message + " Käivita vajadusel Supabase SQL Editoris sql/app_settings_rules.sql." });
      }

      return json(200, { ok: true, text: upd.data.value });
    }


    if (event.httpMethod === "GET" && route === "debug/env") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      return json(200, {
        ok: true,
        supabase_url: getSupabaseUrl() ? "OK" : "MISSING",
        supabase_key: getSupabaseKey() ? "OK" : "MISSING",
        jwt_secret: getJwtSecret() ? "OK" : "MISSING",
        api_football_key: process.env.API_FOOTBALL_KEY ? "OK" : "MISSING"
      });
    }

    // Setup admin once
    if (event.httpMethod === "POST" && route === "setup/admin") {
      const body = JSON.parse(event.body || "{}");
      const username = (body.username || "admin").toString().trim();
      const password = (body.password || "").toString();
      const display_name = (body.display_name || "Admin").toString();
      if (password.length < 6) return json(400, { error: "Parool peab olema vähemalt 6 tähemärki." });

      const existing = await sb.from("players").select("id").eq("is_admin", true).limit(1);
      if (existing.error) return json(500, { error: existing.error.message });
      if ((existing.data || []).length > 0) return json(409, { error: "Admin on juba olemas." });

      const password_hash = await bcrypt.hash(password, 10);
      const ins = await sb.from("players").insert({ username, display_name, password_hash, is_admin: true })
        .select("id,username,display_name,is_admin").single();
      if (ins.error) return json(500, { error: ins.error.message });
      return json(200, { ok: true, admin: ins.data });
    }

    // Login
    if (event.httpMethod === "POST" && route === "login") {
      const body = JSON.parse(event.body || "{}");
      const username = (body.username || "").toString().trim();
      const password = (body.password || "").toString();
      if (!username || !password) return json(400, { error: "Puudub username või password." });

      const q = await sb.from("players").select("id,username,display_name,password_hash,is_admin").eq("username", username).limit(1);
      if (q.error) return json(500, { error: q.error.message });
      const u = (q.data || [])[0];
      if (!u) return json(401, { error: "Kasutajat ei leitud. Kui see on uus andmebaas, loo esmalt admin konto." });

      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) return json(401, { error: "Vale parool." });

      const token = jwt.sign(
        { sub: u.id, username: u.username, display_name: u.display_name, is_admin: u.is_admin },
        getEnv("JWT_SECRET"),
        { expiresIn: "30d" }
      );
      return json(200, { ok: true, token, user: { id: u.id, username: u.username, display_name: u.display_name, is_admin: u.is_admin }});
    }



// Public registration: POST /api/register { username, password, password_confirm }
if (event.httpMethod === "POST" && route === "register") {
  const body = JSON.parse(event.body || "{}");
  const username = (body.username || "").toString().trim();
  const password = (body.password || "").toString();
  const password_confirm = (body.password_confirm || "").toString();

  if (!username || password.length < 6) {
    return json(400, { error: "Sisesta kasutajanimi ja parool vähemalt 6 tähemärki." });
  }
  if (password !== password_confirm) {
    return json(400, { error: "Paroolid ei kattu." });
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return json(400, { error: "Kasutajanimi peab olema 3-32 märki ja võib sisaldada tähti, numbreid, punkti, sidekriipsu või alakriipsu." });
  }

  const exists = await sb.from("players").select("id").eq("username", username).limit(1);
  if (exists.error) return json(500, { error: exists.error.message });
  if ((exists.data || []).length > 0) return json(409, { error: "See kasutajanimi on juba võetud." });

  const password_hash = await bcrypt.hash(password, 10);
  const ins = await sb.from("players")
    .insert({ username, display_name: username, password_hash, is_admin: false })
    .select("id,username,display_name,is_admin")
    .single();

  if (ins.error) return json(500, { error: ins.error.message });

  const token = jwt.sign(
    { sub: ins.data.id, username: ins.data.username, display_name: ins.data.display_name, is_admin: ins.data.is_admin },
    getEnv("JWT_SECRET"),
    { expiresIn: "30d" }
  );

  return json(200, { ok: true, token, user: ins.data });
}

if (event.httpMethod === "GET" && route === "me") {
      const u = await freshUserFrom(sb, event);
      if (!u) return json(401, { error: "Pole sisse logitud." });
      return json(200, { ok: true, user: {
        id: u.id,
        sub: u.sub,
        username: u.username,
        display_name: u.display_name,
        is_admin: u.is_admin
      }});
    }

    // Change password (self)
    if (event.httpMethod === "POST" && route === "password") {
      const u = userFrom(event);
      if (!u) return json(401, { error: "Pole sisse logitud." });
      const body = JSON.parse(event.body || "{}");
      const oldp = (body.old_password || "").toString();
      const newp = (body.new_password || "").toString();
      if (newp.length < 6) return json(400, { error: "Uus parool peab olema vähemalt 6 tähemärki." });

      const q = await sb.from("players").select("password_hash").eq("id", u.sub).single();
      if (q.error) return json(500, { error: q.error.message });
      const ok = await bcrypt.compare(oldp, q.data.password_hash);
      if (!ok) return json(401, { error: "Vana parool vale." });

      const password_hash = await bcrypt.hash(newp, 10);
      const upd = await sb.from("players").update({ password_hash }).eq("id", u.sub);
      if (upd.error) return json(500, { error: upd.error.message });
      return json(200, { ok: true });
    }

    // Matches list
    if (event.httpMethod === "GET" && route === "matches") {
      const m = await sb.from("matches").select("*").order("match_no", { ascending: true });
      if (m.error) return json(500, { error: m.error.message });
      return json(200, { ok: true, matches: sanitizeWorldCupMatchesForDisplay(m.data || []) });
    }


    // Admin API-Football debug: shows candidate fixtures for a match number
    if (event.httpMethod === "GET" && route === "admin/debug/api-football") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      const no = Number(event.queryStringParameters?.match_no || 0);
      if (!no) return json(400, { error: "Lisa query: ?match_no=..." });

      const matchRes = await sb.from("matches").select("*").eq("match_no", no).single();
      if (matchRes.error) return json(500, { error: matchRes.error.message });

      const date = apiFootballDateOnly(trustedKickoffUtcForLock(matchRes.data) || matchRes.data.kickoff_utc);
      const fetched = await fetchApiFootballFixtures(date ? [date] : []);
      if (!fetched.ok) return json(500, { error: fetched.error || "API-Football viga" });

      const candidates = (fetched.fixtures || [])
        .filter(fx => fixtureAllowedForMatch(matchRes.data, fx))
        .map(fx => ({
          fixture_id: fx?.fixture?.id,
          date: fx?.fixture?.date,
          status: fx?.fixture?.status?.short,
          home: fx?.teams?.home?.name,
          away: fx?.teams?.away?.name,
          goals: `${fx?.goals?.home ?? ""}:${fx?.goals?.away ?? ""}`,
          fulltime: `${fx?.score?.fulltime?.home ?? ""}:${fx?.score?.fulltime?.away ?? ""}`,
          score: scoreFixtureMatch(matchRes.data, fx)
        }))
        .sort((a,b) => b.score - a.score)
        .slice(0, 10);

      return json(200, { ok:true, match: matchRes.data, requested: fetched.requested || [], api_errors: fetched.errors || [], candidates });
    }


    // Admin bulk manual result import
    if (event.httpMethod === "POST" && route === "admin/results/import") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      const body = JSON.parse(event.body || "{}");
      const text = String(body.text || "");
      const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);

      if (!lines.length) return json(400, { error: "Sisesta vähemalt üks tulemus." });

      const updated = [];
      const errors = [];

      for (const line of lines) {
        const parsed = parseManualResultLine(line);

        if (!parsed) continue;
        if (parsed.error) {
          errors.push(parsed.error);
          continue;
        }

        const matchRes = await sb
          .from("matches")
          .select("id,match_no,home,away,stage")
          .eq("match_no", parsed.match_no)
          .single();

        if (matchRes.error || !matchRes.data) {
          errors.push(`#${parsed.match_no}: mängu ei leitud`);
          continue;
        }

        const isDraw = parsed.final_home === parsed.final_away;
        const isPlayoff = isPlayoffMatch(matchRes.data);
        const winner = isDraw && isPlayoff ? normalizeWinner(parsed.winner) : normalizeWinner(parsed.winner);

        if (isDraw && isPlayoff && !winner) {
          errors.push(`#${parsed.match_no}: play-off viigi puhul lisa edasipääseja home või away`);
          continue;
        }

        const patch = {
          final_home: parsed.final_home,
          final_away: parsed.final_away,
          is_finished: true,
          manual_result_override: true,
          api_status_short: "",
          went_extra: isPlayoff && isDraw && !!winner
        };

        if (winner) patch.winner = winner;

        const upd = await sb
          .from("matches")
          .update(patch)
          .eq("id", matchRes.data.id)
          .select("*")
          .single();

        if (upd.error) {
          errors.push(`#${parsed.match_no}: ${upd.error.message}`);
          continue;
        }

        await recalcPointsForMatch(sb, matchRes.data.id);

        updated.push({
          match_no: parsed.match_no,
          home: matchRes.data.home,
          away: matchRes.data.away,
          score: `${parsed.final_home}:${parsed.final_away}`,
          winner: winner || ""
        });
      }

      const derived = await updateDerivedPlayoffMatches(sb);

      return json(200, {
        ok: true,
        updated_count: updated.length,
        error_count: errors.length,
        derived_updates: derived.updated || 0,
        updated,
        errors
      });
    }


    // Optional Railway cron sync. Set CRON_SECRET and call /api/cron/sync or /api/cron/sync/results with Bearer token, x-cron-secret header or ?secret=...
    if (event.httpMethod === "POST" && (route === "cron/sync/results" || route === "cron/sync")) {
      const configuredSecret = process.env.CRON_SECRET || "";
      const h = event.headers || {};
      const auth = h.authorization || h.Authorization || "";
      const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1] || "";
      const providedSecret =
        h["x-cron-secret"] ||
        h["X-Cron-Secret"] ||
        bearer ||
        event.queryStringParameters?.secret ||
        "";

      if (!configuredSecret || providedSecret !== configuredSecret) {
        return json(403, { error: "Croni õigused puuduvad." });
      }

      const sync = await syncApiFootballResults(sb, { force:true });
      if (!sync.ok) return json(500, { error: sync.error || "Tulemuste sünkroniseerimine ebaõnnestus." });
      return json(200, { ok:true, ...sync });
    }

    // Admin sync results from API-Football
    if (event.httpMethod === "POST" && route === "admin/sync/results") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });
      const sync = await syncApiFootballResults(sb, { force:true });
      if (!sync.ok) return json(500, { error: sync.error || "Tulemuste sünkroniseerimine ebaõnnestus." });
      return json(200, { ok:true, ...sync });
    }


// Admin seed UEFA U17 test matches
if (event.httpMethod === "POST" && route === "admin/seed/u17-test") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const up = await sb.from("matches").upsert(U17_TEST_MATCHES.map(x => ({...x})), { onConflict: "match_no" }).select("id");
  if (up.error) return json(500, { error: up.error.message });
  const derived = await updateDerivedPlayoffMatches(sb);
  return json(200, { ok: true, inserted_or_updated: (up.data || []).length, derived_updates: derived.updated || 0 });
}

// Admin remove UEFA U17 test matches
if (event.httpMethod === "POST" && route === "admin/remove/u17-test") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const idsRes = await sb.from("matches").select("id").eq("stage", "UEFA U17 TEST");
  if (idsRes.error) return json(500, { error: idsRes.error.message });

  const ids = (idsRes.data || []).map(x => x.id);
  if (ids.length) {
    const delPreds = await sb.from("predictions").delete().in("match_id", ids);
    if (delPreds.error) return json(500, { error: delPreds.error.message });
  }

  const delMatches = await sb.from("matches").delete().eq("stage", "UEFA U17 TEST");
  if (delMatches.error) return json(500, { error: delMatches.error.message });

  return json(200, { ok: true, removed: ids.length });
}

// Admin seed Baltic Cup test matches
if (event.httpMethod === "POST" && route === "admin/seed/baltic-cup-test") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const up = await sb.from("matches").upsert(BALTIC_CUP_TEST_MATCHES.map(x => ({...x})), { onConflict: "match_no" }).select("id");
  if (up.error) return json(500, { error: up.error.message });
  const derived = await updateDerivedPlayoffMatches(sb);
  return json(200, { ok: true, inserted_or_updated: (up.data || []).length, derived_updates: derived.updated || 0 });
}

// Admin remove Baltic Cup test matches
if (event.httpMethod === "POST" && route === "admin/remove/baltic-cup-test") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const idsRes = await sb.from("matches").select("id").eq("stage", "BALTIC CUP TEST");
  if (idsRes.error) return json(500, { error: idsRes.error.message });

  const ids = (idsRes.data || []).map(x => x.id);
  if (ids.length) {
    const delPreds = await sb.from("predictions").delete().in("match_id", ids);
    if (delPreds.error) return json(500, { error: delPreds.error.message });
  }

  const delMatches = await sb.from("matches").delete().eq("stage", "BALTIC CUP TEST");
  if (delMatches.error) return json(500, { error: delMatches.error.message });

  return json(200, { ok: true, removed: ids.length });
}




// Admin cleanup: clears bogus results from unresolved World Cup placeholder matches.
// Does not delete users, predictions or matches. It only removes fake scores from rows like W101/W102.
if (event.httpMethod === "POST" && route === "admin/cleanup/unresolved-playoff") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const result = await clearUnresolvedWorldCupResults(sb);
  const derived = await updateDerivedPlayoffMatches(sb);
  return json(200, { ok: true, ...result, derived_updates: derived.updated || 0 });
}

// Admin schedule check/fix. Does not delete rows, create rows, change matches.id or touch predictions.
if (event.httpMethod === "GET" && route === "admin/schedule/check") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const result = await getScheduleDiffs(sb);
  return json(200, { ok: true, ...result });
}

if (event.httpMethod === "POST" && route === "admin/schedule/fix") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const result = await fixScheduleFromSeed(sb);
  return json(200, { ok: true, ...result });
}

    // Admin seed matches (idempotent upsert by match_no)
    if (event.httpMethod === "POST" && route === "admin/seed/matches") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      const existing = await sb.from("matches").select("id").limit(1);
      if (existing.error) return json(500, { error: existing.error.message });

      const payload = SEED_MATCHES.map(x => ({...x}));
      // Upsert needs unique constraint on match_no
      const up = await sb.from("matches").upsert(payload, { onConflict: "match_no" }).select("id");
      if (up.error) return json(500, { error: up.error.message });
      const derived = await updateDerivedPlayoffMatches(sb);

      return json(200, { ok: true, inserted_or_updated: up.data.length, derived_updates: derived.updated || 0 });
    }


// Admin import kickoff times (ET) -> stores kickoff_utc
// POST /api/admin/import/kickoffs  { items: [{match_no, date_et:'YYYY-MM-DD', time_et:'HH:MM'}] }
if (event.httpMethod === "POST" && route === "admin/import/kickoffs") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const body = JSON.parse(event.body || "{}");
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json(400, { error: "Puudub items." });

  const updates = [];
  for (const it of items) {
    const match_no = Number(it.match_no);
    const date_et = String(it.date_et || "");
    const time_et = String(it.time_et || "");
    if (!match_no) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date_et)) continue;
    if (!/^\d{1,2}:\d{2}$/.test(time_et)) continue;

    const [Y,M,D] = date_et.split("-").map(Number);
    let [hh,mm] = time_et.split(":").map(Number);

    // ET in June/July is typically EDT (UTC-4): UTC = ET + 4h
    hh = hh + 4;
    const dt = new Date(Date.UTC(Y, M-1, D, 0, 0, 0));
    dt.setUTCHours(hh, mm, 0, 0);

    updates.push({ match_no, kickoff_utc: dt.toISOString() });
  }

  if (!updates.length) return json(400, { error: "Ühtegi korrektset rida ei olnud." });

  let updated = 0;
  for (const urow of updates) {
    const r = await sb.from("matches").update({ kickoff_utc: urow.kickoff_utc }).eq("match_no", urow.match_no);
    if (!r.error) updated += 1;
  }

  return json(200, { ok: true, updated });
}


// Admin: sünkroniseeri ametlik ajakava NBC Sports artiklist (ajad ET)
// POST /api/admin/sync/schedule
if (event.httpMethod === "POST" && route === "admin/sync/schedule") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const url = "https://www.nbcsports.com/soccer/news/2026-world-cup-schedule-confirmed-dates-times-stadiums-full-details";
  const resp = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!resp.ok) return json(502, { error: "Ei saanud ajakava kätte." });
  const html = await resp.text();

  // Näited:
  // June 11: Mexico vs South Africa - Estadio Azteca, Mexico City - 3pm ET
  // June 13: Australia vs Turkiye - BC Place, Vancouver - Midnight ET
  // June 27: Colombia vs Portugal - Hard Rock Stadium, Miami - 7:30pm ET
  // June 28: Match 73 - Runner up Group A vs Runner up Group B - SoFi Stadium, Los Angeles - 3pm ET
  const monthMap = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 };

  function parseTimeET(raw) {
    const s = raw.trim().toLowerCase();
    if (s.includes("midnight")) return { h:0, m:0 };
    if (s.includes("noon")) return { h:12, m:0 };
    const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    if (!m) return null;
    let h = Number(m[1]);
    let min = m[2] ? Number(m[2]) : 0;
    const ap = m[3];
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return { h, m:min };
  }

  function toUTCISOString(year, month, day, timeET) {
    // Juuni ja juuli: EDT (UTC-4) -> UTC = ET + 4h
    const dt = new Date(Date.UTC(year, month-1, day, 0, 0, 0));
    dt.setUTCHours(timeET.h + 4, timeET.m, 0, 0);
    return dt.toISOString();
  }

  // 1) Knockout: sisaldab Match N
  const ko = [];
  const reKO = /(June|July)\s+(\d{1,2}):\s*Match\s+(\d{1,3})\s*-\s*([^<\n]+?)\s*-\s*([0-9:apmMidnightNoon\s]+)\s*ET/gi;
  let m;
  while ((m = reKO.exec(html)) !== null) {
    const mon = monthMap[m[1]];
    const day = Number(m[2]);
    const matchNo = Number(m[3]);
    const time = parseTimeET(m[5]);
    if (!mon || !day || !matchNo || !time) continue;
    ko.push({ match_no: matchNo, kickoff_utc: toUTCISOString(2026, mon, day, time) });
  }

  // 2) Group matches: ilma Match numbrita, parseeri kõik read "Month day: X vs Y ... time ET"
  const gm = [];
  const reGM = /(June|July)\s+(\d{1,2}):\s*([A-Za-z \.'-]+?)\s+vs\s+([A-Za-z \.'-]+?)\s*-\s*[^<\n]+?\s*-\s*([0-9:apmMidnightNoon\s]+)\s*ET/gi;
  while ((m = reGM.exec(html)) !== null) {
    const mon = monthMap[m[1]];
    const day = Number(m[2]);
    const home = m[3].trim();
    const away = m[4].trim();
    const time = parseTimeET(m[5]);
    if (!mon || !day || !home || !away || !time) continue;
    // Ignore lines that are actually knockout (they include "Match", already handled)
    if (/^Match\s+\d+/i.test(home)) continue;
    gm.push({ home, away, kickoff_utc: toUTCISOString(2026, mon, day, time) });
  }

  // Sorteeri kronoloogiliselt ja seo match_no 1..72
  gm.sort((a,b)=>a.kickoff_utc.localeCompare(b.kickoff_utc));

  const existing = await sb.from("matches").select("id,match_no").order("match_no", { ascending: true });
  if (existing.error) return json(500, { error: existing.error.message });

  // Update group stage match numbers 1..72 by order
  let updated = 0;
  for (let i=0; i<gm.length && i<72; i++) {
    const matchNo = i+1;
    const r = await sb.from("matches").update({ kickoff_utc: gm[i].kickoff_utc }).eq("match_no", matchNo);
    if (!r.error) updated += 1;
  }

  // Update knockout by match_no
  for (const k of ko) {
    const r = await sb.from("matches").update({ kickoff_utc: k.kickoff_utc }).eq("match_no", k.match_no);
    if (!r.error) updated += 1;
  }

  return json(200, { ok: true, updated, group_parsed: gm.length, knockout_parsed: ko.length, source: url });
}



// Admin: delete match by id and its predictions
if (event.httpMethod === "DELETE" && route.startsWith("admin/matches/")) {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const id = route.split("/").pop();
  if (!id) return json(400, { error: "Mängu ID puudub." });

  const delPreds = await sb.from("predictions").delete().eq("match_id", id);
  if (delPreds.error) return json(500, { error: delPreds.error.message });

  const delMatch = await sb.from("matches").delete().eq("id", id);
  if (delMatch.error) return json(500, { error: delMatch.error.message });

  return json(200, { ok: true });
}

// Admin: update match by match_no (used by manual result/time fields)
if (event.httpMethod === "PUT" && route.startsWith("admin/matches/by-no/")) {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const matchNo = Number(route.split("/").pop());
  if (!matchNo) return json(400, { error: "Mängu number puudub." });

  const body = JSON.parse(event.body || "{}");
  const patch = {};
  if (body.home !== undefined) patch.home = String(body.home);
  if (body.away !== undefined) patch.away = String(body.away);
  if (body.stage !== undefined) patch.stage = String(body.stage);
  if (body.location !== undefined) patch.location = String(body.location);
  if (body.kickoff_utc !== undefined) patch.kickoff_utc = body.kickoff_utc || null;
  if (body.final_home !== undefined) patch.final_home = body.final_home === null ? null : Number(body.final_home);
  if (body.final_away !== undefined) patch.final_away = body.final_away === null ? null : Number(body.final_away);
  if (body.winner !== undefined) patch.winner = normalizeWinner(body.winner);
  if (body.final_home !== undefined || body.final_away !== undefined || body.winner !== undefined) {
    patch.manual_result_override = true;
    patch.api_status_short = "";
    const fhForExtra = patch.final_home;
    const faForExtra = patch.final_away;
    if (Number.isFinite(fhForExtra) && Number.isFinite(faForExtra)) {
      const tempMatch = { match_no: matchNo, stage: patch.stage || "" };
      patch.went_extra = inferWentExtraFromResult(tempMatch, fhForExtra, faForExtra, patch.winner);
    }
  }
  if (body.is_finished !== undefined) patch.is_finished = !!body.is_finished;

  const upd = await sb.from("matches").update(patch).eq("match_no", matchNo).select("*").single();
  if (upd.error) return json(500, { error: upd.error.message });

  const fh = upd.data.final_home;
  const fa = upd.data.final_away;
  if (fh !== null && fa !== null && fh !== undefined && fa !== undefined) {
    await recalcPointsForMatch(sb, upd.data.id);
    await updateDerivedPlayoffMatches(sb);
  }

  return json(200, { ok: true, match: upd.data });
}

    // Admin matches create/update/delete
    if (event.httpMethod === "POST" && route === "admin/matches") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });
      const body = JSON.parse(event.body || "{}");
      const ins = await sb.from("matches").insert(body).select("*").single();
      if (ins.error) return json(500, { error: ins.error.message });
      return json(200, { ok: true, match: ins.data });
    }

    const mu = route.match(/^admin\/matches\/(\d+)$/);
    if (mu && event.httpMethod === "PUT") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });
      const id = Number(mu[1]);
      const body = JSON.parse(event.body || "{}");
      if (body.winner !== undefined) body.winner = normalizeWinner(body.winner);
      const resultChanged = body.final_home !== undefined || body.final_away !== undefined || body.winner !== undefined;
      if (resultChanged) {
        body.manual_result_override = true;
        body.api_status_short = "";
      }
      const upd = await sb.from("matches").update(body).eq("id", id).select("*").single();
      if (upd.error) return json(500, { error: upd.error.message });

      let updatedMatch = upd.data;
      const fh = updatedMatch.final_home;
      const fa = updatedMatch.final_away;

      if (resultChanged && fh !== null && fa !== null && fh !== undefined && fa !== undefined) {
        const wentExtra = inferWentExtraFromResult(updatedMatch, fh, fa, updatedMatch.winner);
        const extraUpd = await sb.from("matches").update({ went_extra: wentExtra }).eq("id", id).select("*").single();
        if (!extraUpd.error && extraUpd.data) updatedMatch = extraUpd.data;
      }

      if (fh !== null && fa !== null && fh !== undefined && fa !== undefined) {
        await recalcPointsForMatch(sb, id);
        await updateDerivedPlayoffMatches(sb);
      }

      return json(200, { ok: true, match: updatedMatch });
    }

    if (mu && event.httpMethod === "DELETE") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });
      const id = Number(mu[1]);
      const del = await sb.from("matches").delete().eq("id", id);
      if (del.error) return json(500, { error: del.error.message });
      return json(200, { ok: true });
    }

    // Predictions (my)
    if (event.httpMethod === "GET" && route === "predictions") {
      const u = userFrom(event);
      if (!u) return json(401, { error: "Pole sisse logitud." });
      const q = await sb.from("predictions").select("match_id,pred_home,pred_away,pred_winner,points").eq("player_id", u.sub);
      if (q.error) return json(500, { error: q.error.message });
      return json(200, { ok: true, predictions: q.data });
    }

// Public view of other players' predictions after lock or after match end
if (event.httpMethod === "GET" && route === "predictions/public") {
  const u = userFrom(event);
  if (!u) return json(401, { error: "Pole sisse logitud." });

  const matchesRes = await fetchAllRows(() => sb.from("matches").select("id,match_no,stage,home,away,kickoff_utc,is_finished").order("id", { ascending: true }));
  if (matchesRes.error) return json(500, { error: matchesRes.error.message });

  const now = Date.now();
  const openMatchIds = [];
  for (const m of sanitizeWorldCupMatchesForDisplay(matchesRes.data || [])) {
    if (isPredictionRevealOpen(m, now)) openMatchIds.push(m.id);
  }

  if (!openMatchIds.length) return json(200, { ok: true, predictions_by_match: {} });

  const predsRes = await fetchAllRows(() => sb
    .from("predictions")
    .select("id,match_id,player_id,pred_home,pred_away,pred_winner")
    .in("match_id", openMatchIds)
    .order("id", { ascending: true }));

  if (predsRes.error) return json(500, { error: predsRes.error.message });

  const playersRes = await fetchAllRows(() => sb.from("players").select("id,display_name,is_admin").order("display_name", { ascending: true }));
  if (playersRes.error) return json(500, { error: playersRes.error.message });

  const playerMap = new Map((playersRes.data || []).filter(p => !p.is_admin).map(p => [p.id, p.display_name]));
  const grouped = {};
  for (const p of predsRes.data || []) {
    if (p.player_id === u.sub) continue;
    if (!playerMap.has(p.player_id)) continue;
    if (!grouped[p.match_id]) grouped[p.match_id] = [];
    grouped[p.match_id].push({
      player_id: p.player_id,
      display_name: playerMap.get(p.player_id) || "Mängija",
      pred_home: p.pred_home,
      pred_away: p.pred_away,
      pred_winner: p.pred_winner
    });
  }

  return json(200, { ok: true, predictions_by_match: grouped });
}



// Matrix data for "Teiste ennustused" view
if (event.httpMethod === "GET" && route === "predictions/matrix") {
  const u = userFrom(event);
  if (!u) return json(401, { error: "Pole sisse logitud." });

  const playersRes = await fetchAllRows(() => sb
    .from("players")
    .select("id,display_name,is_admin,created_at")
    .order("display_name", { ascending: true }));

  if (playersRes.error) return json(500, { error: playersRes.error.message });

  const matchesRes = await fetchAllRows(() => sb
    .from("matches")
    .select("id,match_no,stage,home,away,location,kickoff_utc,final_home,final_away,winner,is_finished,went_extra,api_status_short,manual_result_override")
    .order("match_no", { ascending: true }));

  if (matchesRes.error) return json(500, { error: matchesRes.error.message });

  const now = Date.now();

  const visibleMatches = sanitizeWorldCupMatchesForDisplay(matchesRes.data || []).filter(m => {
    // Teiste ennustused vaates on teiste mängijate skoorid nähtavad ainult siis,
    // kui konkreetne mäng on lukus ehk kickoffini on jäänud 1 tund või vähem.
    // Isegi is_finished/final_home/final_away ei tohi tulevase mängu andmeid avada,
    // sest halb sync või käsitsi test võib jätta tulevasele mängule fake tulemuse.
    return isPredictionRevealOpen(m, now);
  }).sort((a,b) => {
    const ta = a.kickoff_utc ? new Date(a.kickoff_utc).getTime() : 0;
    const tb = b.kickoff_utc ? new Date(b.kickoff_utc).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (Number(b.match_no) || 0) - (Number(a.match_no) || 0);
  });

  const matchIds = visibleMatches.map(m => m.id);
  let predictions = [];

  if (matchIds.length) {
    const predsRes = await fetchAllRows(() => sb
      .from("predictions")
      .select("id,match_id,player_id,pred_home,pred_away,pred_winner,points")
      .in("match_id", matchIds)
      .order("id", { ascending: true }));

    if (predsRes.error) return json(500, { error: predsRes.error.message });
    const visibleMatchMap = new Map(visibleMatches.map(m => [m.id, m]));
    predictions = (predsRes.data || []).map(p => {
      const match = visibleMatchMap.get(p.match_id);
      const correctedPoints = matchHasUsableResult(match)
        ? calcPoints(p.pred_home, p.pred_away, match.final_home, match.final_away, { match, pred_winner: p.pred_winner })
        : 0;
      return { ...p, points: correctedPoints, stored_points: Number(p.points) || 0 };
    });
  }

  return json(200, {
    ok: true,
    players: (playersRes.data || []).filter(p => !p.is_admin).sort((a,b) => String(a.display_name || "").localeCompare(String(b.display_name || ""), "et")),
    matches: visibleMatches,
    predictions
  });
}

    if (event.httpMethod === "POST" && route === "predictions") {
  const u = userFrom(event);
  if (!u) return json(401, { error: "Pole sisse logitud." });
  const body = JSON.parse(event.body || "{}");
  const match_id = Number(body.match_id);
  const pred_home = Number(body.pred_home);
  const pred_away = Number(body.pred_away);
  const pred_winner = normalizeWinner(body.pred_winner);

  if (!Number.isFinite(match_id) || !Number.isFinite(pred_home) || !Number.isFinite(pred_away)) {
    return json(400, { error: "Sisesta numbrid." });
  }

  const m = await sb.from("matches")
    .select("id,match_no,stage,home,away,final_home,final_away,winner,kickoff_utc,is_finished,went_extra,api_status_short,manual_result_override")
    .eq("id", match_id)
    .single();

  if (m.error) return json(500, { error: m.error.message });

  const allMatchesForVisibility = await fetchAllRows(() => sb
    .from("matches")
    .select("id,match_no,stage,home,away,final_home,final_away,winner,kickoff_utc,is_finished")
    .gte("match_no", 1)
    .lte("match_no", 104)
    .order("match_no", { ascending: true }));

  if (allMatchesForVisibility.error) return json(500, { error: allMatchesForVisibility.error.message });

  const visibleForPrediction = sanitizeWorldCupMatchesForDisplay(allMatchesForVisibility.data || []);
  const matchForPrediction = visibleForPrediction.find(x => Number(x.id) === match_id);
  if (!matchForPrediction) return json(400, { error: "See ei ole MM ennustusmäng." });

  if (!u.is_admin && matchForPrediction.kickoff_utc) {
    const kickoff = new Date(matchForPrediction.kickoff_utc).getTime();
    const lockAt = kickoff - 60 * 60 * 1000;
    const now = Date.now();
    if (Number.isFinite(kickoff) && now >= lockAt) {
      return json(403, { error: "Ennustus on lukus (lukustub 1 tund enne mängu algust)." });
    }
  }

  const playoff = isPlayoffMatch(matchForPrediction);
  const needsWinner = playoff && pred_home === pred_away;

  if (needsWinner && !pred_winner) {
    return json(400, { error: "Viigilise play-off ennustuse korral vali ka edasipääseja." });
  }

  const savedWinner = needsWinner ? pred_winner : null;

  const scoringMatch = sanitizeWorldCupMatchForDisplay(m.data);
  const points = calcPoints(pred_home, pred_away, scoringMatch.final_home, scoringMatch.final_away, {
    match: scoringMatch,
    pred_winner: savedWinner
  });

  const up = await sb.from("predictions").upsert({
    player_id: u.sub,
    match_id,
    pred_home,
    pred_away,
    pred_winner: savedWinner,
    points
  }, { onConflict: "player_id,match_id" }).select("match_id,pred_home,pred_away,pred_winner,points").single();

  if (up.error) return json(500, { error: up.error.message });
  return json(200, { ok: true, prediction: up.data });
}




// Lisaküsimused kasutajale
if (event.httpMethod === "GET" && route === "bonus/questions") {
  const u = userFrom(event);
  if (!u) return json(401, { error: "Pole sisse logitud." });

  try{
    await ensureBonusQuestions(sb);
  }catch(e){
    return json(500, { error: e.message });
  }

  const lock = await getBonusLockInfo(sb);

  const questions = await sb
    .from("bonus_questions")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (questions.error) return json(500, { error: questions.error.message });

  const answers = await sb
    .from("bonus_answers")
    .select("question_id,answer_text,answer_value,is_correct,points")
    .eq("player_id", u.sub);

  if (answers.error) return json(500, { error: answers.error.message });

  const players = await sb
    .from("players")
    .select("id,display_name,is_admin")
    .order("display_name", { ascending: true });

  if (players.error) return json(500, { error: players.error.message });

  const visibleQuestions = (questions.data || []).filter(q => String(q.question_text || "").trim());

  return json(200, {
    ok: true,
    ...lock,
    questions: visibleQuestions,
    answers: answers.data || [],
    players: (players.data || []).filter(p => !p.is_admin)
  });
}

// Salvesta kasutaja lisaküsimuste vastused
if (event.httpMethod === "POST" && route === "bonus/answers") {
  const u = userFrom(event);
  if (!u) return json(401, { error: "Pole sisse logitud." });

  try{
    await ensureBonusQuestions(sb);
  }catch(e){
    return json(500, { error: e.message });
  }

  const lock = await getBonusLockInfo(sb);
  if (lock.locked && !u.is_admin) {
    return json(403, { error: "Lisaküsimused on lukus." });
  }

  const body = JSON.parse(event.body || "{}");
  const answers = Array.isArray(body.answers) ? body.answers : [];

  if (!answers.length) return json(400, { error: "Vastuseid ei leitud." });

  const q = await sb.from("bonus_questions").select("id,question_text").eq("active", true);
  if (q.error) return json(500, { error: q.error.message });

  const validQuestionIds = new Set(
    (q.data || [])
      .filter(x => String(x.question_text || "").trim())
      .map(x => Number(x.id))
  );

  const rows = answers
    .map(a => ({
      player_id: u.sub,
      question_id: Number(a.question_id),
      answer_text: String(a.answer_text || "").normalize("NFC").trim(),
      answer_value: String(a.answer_value || "").normalize("NFC").trim()
    }))
    .filter(a => Number.isFinite(a.question_id) && validQuestionIds.has(a.question_id));

  if (!rows.length) return json(400, { error: "Vastuseid ei leitud." });

  for (const row of rows) {
    const existing = await sb
      .from("bonus_answers")
      .select("answer_text,answer_value,is_correct,points")
      .eq("player_id", row.player_id)
      .eq("question_id", row.question_id)
      .maybeSingle();

    if (existing.error) return json(500, { error: existing.error.message });

    const changed =
      String(existing.data?.answer_text || "") !== row.answer_text ||
      String(existing.data?.answer_value || "") !== row.answer_value;

    const payload = {
      ...row,
      is_correct: changed ? false : (existing.data?.is_correct || false),
      points: changed ? 0 : (existing.data?.points || 0)
    };

    const up = await sb
      .from("bonus_answers")
      .upsert(payload, { onConflict: "player_id,question_id" });

    if (up.error) return json(500, { error: up.error.message });
  }

  const saved = await sb
    .from("bonus_answers")
    .select("question_id,answer_text,answer_value,is_correct,points")
    .eq("player_id", u.sub);

  if (saved.error) return json(500, { error: saved.error.message });

  return json(200, { ok: true, saved_count: rows.length, answers: saved.data || [] });
}


// Admin lisaküsimuste käsitsi lukk
if (event.httpMethod === "GET" && route === "admin/bonus/lock") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const lock = await getBonusLockInfo(sb);
  return json(200, { ok: true, ...lock });
}

if (event.httpMethod === "POST" && route === "admin/bonus/lock") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const body = JSON.parse(event.body || "{}");
  const locked = !!body.locked;

  await setBonusManualLock(sb, locked);
  const lock = await getBonusLockInfo(sb);

  return json(200, { ok: true, ...lock });
}

// Lisa vaikimisi lisaküsimused admini nupuga
if (event.httpMethod === "POST" && route === "admin/bonus/seed") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  try{
    await ensureBonusQuestions(sb);
  }catch(e){
    return json(500, { error: e.message });
  }

  const questions = await sb
    .from("bonus_questions")
    .select("*")
    .order("sort_order", { ascending: true });

  if (questions.error) return json(500, { error: questions.error.message });

  return json(200, { ok: true, questions: questions.data || [] });
}

// Lisaküsimused adminile
if (event.httpMethod === "GET" && route === "admin/bonus") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  try{
    await ensureBonusQuestions(sb);
  }catch(e){
    return json(500, { error: e.message });
  }

  const questions = await sb
    .from("bonus_questions")
    .select("*")
    .order("sort_order", { ascending: true });

  const players = await sb
    .from("players")
    .select("id,display_name,is_admin")
    .order("display_name", { ascending: true });

  const answers = await sb
    .from("bonus_answers")
    .select("player_id,question_id,answer_text,answer_value,is_correct,points");

  if (questions.error || players.error || answers.error) {
    return json(500, { error: (questions.error || players.error || answers.error).message });
  }

  return json(200, {
    ok: true,
    questions: questions.data || [],
    players: (players.data || []).filter(p => !p.is_admin),
    answers: answers.data || []
  });
}


// Lisa uus lisaküsimus adminis
if (event.httpMethod === "POST" && route === "admin/bonus/questions") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const body = JSON.parse(event.body || "{}");
  const question_text = String(body.question_text || "").trim();
  const correct_answer = String(body.correct_answer || "").trim();
  const correct_answer_value = String(body.correct_answer_value || "").trim();
  const typeInfo = inferBonusAnswerType(question_text);
  const answer_type = String(body.answer_type || typeInfo.answer_type || "text").trim();
  const options_source = String(body.options_source || typeInfo.options_source || "").trim();
  const points = Number(body.points) || 3;

  if (!question_text) return json(400, { error: "Sisesta küsimuse tekst." });

  const maxOrder = await sb
    .from("bonus_questions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  if (maxOrder.error) return json(500, { error: maxOrder.error.message });

  const sort_order = (Number(maxOrder.data?.[0]?.sort_order) || 0) + 1;

  const ins = await sb
    .from("bonus_questions")
    .insert({
      question_text,
      correct_answer,
      correct_answer_value,
      answer_type,
      options_source: options_source || null,
      points,
      sort_order,
      active: true
    })
    .select("*")
    .single();

  if (ins.error) return json(500, { error: ins.error.message });

  return json(200, { ok: true, question: ins.data });
}

// Muuda lisaküsimust adminis
{
  const m = route.match(/^admin\/bonus\/questions\/(\d+)$/);
  if (m && event.httpMethod === "PUT") {
    const u = await requireAdmin(sb, event);
    if (!u) return json(403, { error: "Admini õigused puuduvad." });

    const id = Number(m[1]);
    const body = JSON.parse(event.body || "{}");
    const patch = {};

    if (body.question_text !== undefined) patch.question_text = String(body.question_text || "").trim();
    if (body.correct_answer !== undefined) patch.correct_answer = String(body.correct_answer || "").trim();
    if (body.correct_answer_value !== undefined) patch.correct_answer_value = String(body.correct_answer_value || "").trim();
    if (body.answer_type !== undefined) patch.answer_type = String(body.answer_type || "text").trim();
    if (body.options_source !== undefined) patch.options_source = String(body.options_source || "").trim() || null;
    if (body.points !== undefined) patch.points = Number(body.points) || 3;
    if (body.active !== undefined) patch.active = !!body.active;
    if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order) || 0;

    if (!Object.keys(patch).length) return json(400, { error: "Muudatus puudub." });

    const upd = await sb.from("bonus_questions").update(patch).eq("id", id).select("*").single();
    if (upd.error) return json(500, { error: upd.error.message });

    return json(200, { ok: true, question: upd.data });
  }

  if (m && event.httpMethod === "DELETE") {
    const u = await requireAdmin(sb, event);
    if (!u) return json(403, { error: "Admini õigused puuduvad." });

    const id = Number(m[1]);
    if (!Number.isFinite(id)) return json(400, { error: "Vigane lisaküsimuse ID." });

    const delAnswers = await sb
      .from("bonus_answers")
      .delete()
      .eq("question_id", id);

    if (delAnswers.error) return json(500, { error: delAnswers.error.message });

    const delQuestion = await sb
      .from("bonus_questions")
      .delete()
      .eq("id", id);

    if (delQuestion.error) return json(500, { error: delQuestion.error.message });

    return json(200, { ok: true, deleted_question_id: id });
  }
}

// Märgi kasutaja lisavastus õigeks või valeks
if (event.httpMethod === "PUT" && route === "admin/bonus/answers") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const body = JSON.parse(event.body || "{}");
  const player_id = String(body.player_id || "");
  const question_id = Number(body.question_id);
  const is_correct = !!body.is_correct;

  if (!player_id || !Number.isFinite(question_id)) {
    return json(400, { error: "Puudub mängija või küsimus." });
  }

  const q = await sb.from("bonus_questions").select("points").eq("id", question_id).single();
  if (q.error) return json(500, { error: q.error.message });

  const current = await sb
    .from("bonus_answers")
    .select("answer_text,answer_value")
    .eq("player_id", player_id)
    .eq("question_id", question_id)
    .maybeSingle();

  if (current.error) return json(500, { error: current.error.message });

  const answer_text = current.data?.answer_text || "";
  const points = is_correct ? (Number(q.data?.points) || 3) : 0;

  const upd = await sb
    .from("bonus_answers")
    .upsert({
      player_id,
      question_id,
      answer_text,
      answer_value: current.data?.answer_value || "",
      is_correct,
      points
    }, { onConflict: "player_id,question_id" })
    .select("player_id,question_id,answer_text,answer_value,is_correct,points")
    .single();

  if (upd.error) return json(500, { error: upd.error.message });

  return json(200, { ok: true, answer: upd.data });
}


// Kontrolli ühe lisaküsimuse vastused automaatselt
{
  const m = route.match(/^admin\/bonus\/questions\/(\d+)\/autograde$/);
  if (m && event.httpMethod === "POST") {
    const u = await requireAdmin(sb, event);
    if (!u) return json(403, { error: "Admini õigused puuduvad." });

    const question_id = Number(m[1]);

    const q = await sb
      .from("bonus_questions")
      .select("*")
      .eq("id", question_id)
      .single();

    if (q.error || !q.data) return json(404, { error: "Lisaküsimust ei leitud." });

    const correctValue = String(q.data.correct_answer_value || "").trim();
    const correctText = String(q.data.correct_answer || "").trim();

    if (!correctValue && !correctText) {
      return json(400, { error: "Õige vastus puudub. Salvesta enne õige vastus." });
    }

    const answers = await sb
      .from("bonus_answers")
      .select("*")
      .eq("question_id", question_id);

    if (answers.error) return json(500, { error: answers.error.message });

    let updated = 0;
    let correct = 0;
    let wrong = 0;
    let missing = 0;
    const pointsForCorrect = Number(q.data.points) || 3;

    for (const a of answers.data || []) {
      const answerValue = String(a.answer_value || "").trim();
      const answerText = String(a.answer_text || "").trim();

      if (!answerValue && !answerText) {
        missing += 1;
        continue;
      }

      const isCorrect = correctValue
        ? normalizeBonusCompare(answerValue) === normalizeBonusCompare(correctValue)
        : normalizeBonusCompare(answerText) === normalizeBonusCompare(correctText);

      const upd = await sb
        .from("bonus_answers")
        .update({ is_correct: isCorrect, points: isCorrect ? pointsForCorrect : 0 })
        .eq("player_id", a.player_id)
        .eq("question_id", question_id);

      if (upd.error) return json(500, { error: upd.error.message });

      updated += 1;
      if (isCorrect) correct += 1;
      else wrong += 1;
    }

    return json(200, { ok: true, updated, correct, wrong, missing });
  }
}

// Admin: recalculate all prediction points using the current scoring rules
if (event.httpMethod === "POST" && route === "admin/recalc-points") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const matches = await sb.from("matches").select("id,match_no,final_home,final_away").order("match_no", { ascending: true });
  if (matches.error) return json(500, { error: matches.error.message });

  let checked_matches = 0;
  let updated_matches = 0;
  let skipped_matches = 0;
  let updated_predictions = 0;
  let checked_predictions = 0;
  let error_count = 0;
  const errors = [];

  for (const m of matches.data || []) {
    checked_matches += 1;
    const result = await recalcPointsForMatch(sb, m.id);

    if (result?.skipped) {
      skipped_matches += 1;
      continue;
    }

    if ((result?.checked_predictions || 0) > 0 || (result?.updated_predictions || 0) > 0) {
      updated_matches += 1;
    }

    checked_predictions += result?.checked_predictions || 0;
    updated_predictions += result?.updated_predictions || 0;
    error_count += result?.error_count || 0;

    if (result?.error && errors.length < 10) errors.push(`#${m.match_no}: ${result.error}`);
    for (const err of result?.errors || []) {
      if (errors.length < 10) errors.push(`#${m.match_no}: ${err}`);
    }
  }

  return json(200, {
    ok: true,
    checked_matches,
    updated_matches,
    skipped_matches,
    checked_predictions,
    updated_predictions,
    error_count,
    errors
  });
}


async function fetchAllRows(queryFactory, pageSize = 1000){
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const res = await queryFactory().range(from, to);

    if (res.error) return { data: rows, error: res.error };

    const chunk = res.data || [];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;

    // Kaitse lõputu tsükli vastu, tegelikus kasutuses ei tohiks kunagi täituda.
    if (from > 200000) {
      return { data: rows, error: { message: "Liiga palju ridu edetabeli arvutamiseks." } };
    }
  }

  return { data: rows, error: null };
}


// Leaderboard
if (event.httpMethod === "GET" && route === "leaderboard") {
  const players = await fetchAllRows(() => sb.from("players").select("id,display_name,is_admin").order("created_at", { ascending: true }));
  const preds = await fetchAllRows(() => sb.from("predictions").select("player_id,match_id,pred_home,pred_away,pred_winner,points").order("id", { ascending: true }));
  const matches = await fetchAllRows(() => sb.from("matches").select("id,match_no,stage,home,away,kickoff_utc,is_finished,final_home,final_away,winner,went_extra,api_status_short,manual_result_override").order("match_no", { ascending: true }));
  const bonus = await fetchAllRows(() => sb.from("bonus_answers").select("player_id,points").order("id", { ascending: true }));

  if (players.error || preds.error || matches.error || bonus.error) {
    return json(500, { error: (players.error || preds.error || matches.error || bonus.error).message });
  }

  const allPlayers = (players.data || []).filter(p => !p.is_admin);
  const allPreds = preds.data || [];
  const allMatches = matches.data || [];
  const visibleLeaderboardMatches = sanitizeWorldCupMatchesForDisplay(allMatches);
  const matchMap = new Map(visibleLeaderboardMatches.map(m => [m.id, m]));

  const bonusMap = new Map();
  for (const b of bonus.data || []) {
    bonusMap.set(b.player_id, (bonusMap.get(b.player_id) || 0) + (Number(b.points) || 0));
  }

  // Edetabeli põhireegel:
  // - Kuvamisel arvutame mängupunktid uuesti praeguse usaldatud tulemuse järgi.
  // - See väldib vanu stale predictions.points ridu, mis võisid tekkida vale API fixture'i või vana recalc'i ajal.
  // - DB ridu siin ei muudeta; püsiv ümberarvutus on eraldi admin/recalc-points.
  // - Play-off tabel algab nullist ja kasutab ainult play-off mängude punkte + lisaküsimused.
  // - Alagrupi tabel kasutab ainult alagrupimängude punkte.
  const predictionTotalMap = new Map();
  const storedPredictionTotalMap = new Map();
  const groupPointsMap = new Map();
  const playoffPointsMap = new Map();

  for (const pr of allPreds) {
    const match = matchMap.get(pr.match_id);
    if (!match) continue;

    // Edetabel arvutab punktid kuvamisel alati uuesti praeguse usaldatud mängu tulemuse järgi.
    // See parandab olukorra, kus predictions.points jäi varasema vale API fixture'i või vana recalc'i tõttu seisma.
    // DB-s olevaid ennustusi ega punkte siin ei muudeta.
    if (!matchHasUsableResult(match)) continue;

    const storedPts = Number(pr.points) || 0;
    storedPredictionTotalMap.set(pr.player_id, (storedPredictionTotalMap.get(pr.player_id) || 0) + storedPts);

    const pts = calcPoints(pr.pred_home, pr.pred_away, match.final_home, match.final_away, {
      match,
      pred_winner: pr.pred_winner
    });

    predictionTotalMap.set(pr.player_id, (predictionTotalMap.get(pr.player_id) || 0) + pts);

    if (isGroupMatchForLeaderboard(match)) {
      groupPointsMap.set(pr.player_id, (groupPointsMap.get(pr.player_id) || 0) + pts);
    } else if (isPlayoffMatchForLeaderboard(match)) {
      playoffPointsMap.set(pr.player_id, (playoffPointsMap.get(pr.player_id) || 0) + pts);
    }
  }

  function makeRows(kind) {
    const rows = [];

    for (const p of allPlayers) {
      const groupPoints = Number(groupPointsMap.get(p.id) || 0);
      const playoffMatchPoints = Number(playoffPointsMap.get(p.id) || 0);
      const dbPredictionPoints = Number(predictionTotalMap.get(p.id) || 0);
      const storedPredictionPoints = Number(storedPredictionTotalMap.get(p.id) || 0);
      const bonusPoints = kind === "group" ? 0 : Number(bonusMap.get(p.id) || 0);

      const row = {
        player_id: p.id,
        display_name: p.display_name,
        group_points: 0,
        match_points: 0,
        playoff_match_points: 0,
        bonus_points: bonusPoints,
        db_prediction_points: dbPredictionPoints,
        stored_prediction_points: storedPredictionPoints,
        points: 0
      };

      if (kind === "group") {
        row.group_points = groupPoints;
        row.match_points = groupPoints;
        row.points = groupPoints;
      } else if (kind === "playoff") {
        row.group_points = 0;
        row.playoff_match_points = playoffMatchPoints;
        row.match_points = playoffMatchPoints;
        row.points = playoffMatchPoints + bonusPoints;
      } else {
        row.group_points = groupPoints;
        // Üldtabeli veerus "Play-off" näitame ülejäänud mängupunkte nii, et
        // alagrupp + play-off veerud klapiksid otse DB predictions.points summaga.
        row.playoff_match_points = Math.max(0, dbPredictionPoints - groupPoints);
        row.match_points = dbPredictionPoints;
        row.points = dbPredictionPoints + bonusPoints;
      }

      rows.push(row);
    }

    return rows.sort((a,b) => {
      if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
      return String(a.display_name || "").localeCompare(String(b.display_name || ""), "et");
    });
  }

  const groupCurrent = makeRows("group");
  const playoffCurrent = makeRows("playoff");
  const overallCurrent = makeRows("overall");

  const group_leaderboard = await addRankMovementWithSnapshot(sb, "group", groupCurrent);
  const playoff_leaderboard = await addRankMovementWithSnapshot(sb, "playoff", playoffCurrent);
  const overall_leaderboard = await addRankMovementWithSnapshot(sb, "overall", overallCurrent);

  return json(200, {
    ok: true,
    leaderboard: group_leaderboard,
    group_leaderboard,
    playoff_leaderboard,
    overall_leaderboard
  });
}



// Admin: lähenevate mängude ennustamata kontroll
    if (event.httpMethod === "GET" && route === "admin/missing-predictions") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      const modeRaw = String(event.queryStringParameters?.mode || "next5").trim().toLowerCase();
      const mode = modeRaw === "day" ? "day" : "next5";
      const now = Date.now();
      const lockOffsetMs = 60 * 60 * 1000;

      const playersRes = await sb
        .from("players")
        .select("id,username,display_name,is_admin")
        .order("created_at", { ascending: true });

      if (playersRes.error) return json(500, { error: playersRes.error.message });

      const players = (playersRes.data || [])
        .filter(p => !p.is_admin)
        .sort((a,b) => String(a.display_name || a.username || "").localeCompare(String(b.display_name || b.username || ""), "et"));

      const matchesRes = await sb
        .from("matches")
        .select("id,match_no,stage,home,away,kickoff_utc,is_finished")
        .order("kickoff_utc", { ascending: true });

      if (matchesRes.error) return json(500, { error: matchesRes.error.message });

      const dateInTallinn = (value)=>{
        if (!value) return "";
        const d = new Date(value);
        if (!Number.isFinite(d.getTime())) return "";
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Tallinn",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).formatToParts(d);
        const y = parts.find(p => p.type === "year")?.value;
        const m = parts.find(p => p.type === "month")?.value;
        const day = parts.find(p => p.type === "day")?.value;
        return y && m && day ? `${y}-${m}-${day}` : "";
      };

      const eligible = (matchesRes.data || [])
        .filter(m => {
          if (m.is_finished) return false;
          if (!m.kickoff_utc) return false;
          const kick = new Date(m.kickoff_utc).getTime();
          if (!Number.isFinite(kick)) return false;
          return now < kick - lockOffsetMs;
        })
        .sort((a,b) => {
          const at = new Date(a.kickoff_utc).getTime();
          const bt = new Date(b.kickoff_utc).getTime();
          if (at !== bt) return at - bt;
          return (Number(a.match_no) || 0) - (Number(b.match_no) || 0);
        });

      let selected = [];
      let selectedDate = "";

      if (mode === "day") {
        selectedDate = eligible.length ? dateInTallinn(eligible[0].kickoff_utc) : "";
        selected = selectedDate ? eligible.filter(m => dateInTallinn(m.kickoff_utc) === selectedDate) : [];
      } else {
        selected = eligible.slice(0, 5);
      }

      const matchIds = selected.map(m => m.id);
      let predictions = [];

      if (matchIds.length) {
        const predsRes = await sb
          .from("predictions")
          .select("match_id,player_id,pred_home,pred_away")
          .in("match_id", matchIds);

        if (predsRes.error) return json(500, { error: predsRes.error.message });
        predictions = predsRes.data || [];
      }

      const predMap = new Map();
      for (const p of predictions) {
        predMap.set(`${p.player_id}:${p.match_id}`, p);
      }

      const hasPrediction = (p)=>{
        if (!p) return false;
        const h = p.pred_home;
        const a = p.pred_away;
        return h !== null && h !== undefined && h !== "" && a !== null && a !== undefined && a !== "" && Number.isFinite(Number(h)) && Number.isFinite(Number(a));
      };

      const rows = selected.map(m => {
        const kick = new Date(m.kickoff_utc).getTime();
        const missingPlayers = [];
        let predictedCount = 0;

        for (const p of players) {
          const pred = predMap.get(`${p.id}:${m.id}`);
          if (hasPrediction(pred)) {
            predictedCount += 1;
          } else {
            missingPlayers.push({
              id: p.id,
              display_name: p.display_name || p.username || "Mängija",
              username: p.username || ""
            });
          }
        }

        return {
          match: {
            id: m.id,
            match_no: m.match_no,
            stage: m.stage,
            home: m.home,
            away: m.away,
            kickoff_utc: m.kickoff_utc,
            lock_at_utc: Number.isFinite(kick) ? new Date(kick - lockOffsetMs).toISOString() : null
          },
          player_count: players.length,
          predicted_count: predictedCount,
          missing_count: missingPlayers.length,
          missing_players: missingPlayers
        };
      });

      return json(200, {
        ok: true,
        mode,
        selected_date: selectedDate,
        generated_at: new Date().toISOString(),
        player_count: players.length,
        match_count: rows.length,
        rows
      });
    }



// Jooksu challenge: eraldi moodul, ei mõjuta ennustuspunktide arvestust
    if (event.httpMethod === "GET" && route === "running/summary") {
      const u = await freshUserFrom(sb, event);
      if (!u) return json(401, { error: "Pole sisse logitud." });

      const activitiesRes = await sb
        .from("running_activity_types")
        .select("code,label,multiplier,is_active,sort_order")
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });

      if (activitiesRes.error) {
        return json(500, { error: activitiesRes.error.message + " Käivita Supabase SQL Editoris sql/running_entries.sql." });
      }

      const allActivities = activitiesRes.data || [];
      const activeActivities = allActivities.filter(a => a.is_active);
      const activeActivityMap = new Map(activeActivities.map(a => [String(a.code), a]));
      const allActivityMap = new Map(allActivities.map(a => [String(a.code), a]));

      let matchesRes = await sb
        .from("matches")
        .select("id,match_no,stage,home,away,kickoff_utc,final_home,final_away,winner,is_finished,went_extra,api_status_short,manual_result_override,goals_home_120,goals_away_120")
        .gte("match_no", 1)
        .lte("match_no", 104);

      if (matchesRes.error && /goals_home_120|goals_away_120|column/i.test(String(matchesRes.error.message || ""))) {
        // SQL migratsioon võib live'is veel käivitamata olla. Sellisel juhul töötab jooksu vaade edasi 90 minuti skoori pealt.
        matchesRes = await sb
          .from("matches")
          .select("id,match_no,stage,home,away,kickoff_utc,final_home,final_away,winner,is_finished,went_extra,api_status_short,manual_result_override")
          .gte("match_no", 1)
          .lte("match_no", 104);
      }

      if (matchesRes.error) return json(500, { error: matchesRes.error.message });

      let goalTotal = 0;
      for (const rawMatch of matchesRes.data || []) {
        const m = sanitizeWorldCupMatchForDisplay(rawMatch);
        if (!matchHasUsableResult(m)) continue;

        const h120 = Number(rawMatch.goals_home_120);
        const a120 = Number(rawMatch.goals_away_120);
        const h90 = Number(m.final_home);
        const a90 = Number(m.final_away);

        const has120Score = rawMatch.goals_home_120 !== null && rawMatch.goals_home_120 !== undefined &&
          rawMatch.goals_away_120 !== null && rawMatch.goals_away_120 !== undefined &&
          Number.isFinite(h120) && Number.isFinite(a120);
        const has90Score = m.final_home !== null && m.final_home !== undefined &&
          m.final_away !== null && m.final_away !== undefined &&
          Number.isFinite(h90) && Number.isFinite(a90);

        if (has120Score) goalTotal += h120 + a120;
        else if (has90Score) goalTotal += h90 + a90;
      }

      const entriesRes = await sb
        .from("running_entries")
        .select("id,player_id,activity_type,activity_multiplier,run_date,kilometers,note,created_at")
        .order("created_at", { ascending: false });

      if (entriesRes.error) {
        return json(500, { error: entriesRes.error.message + " Käivita Supabase SQL Editoris sql/running_entries.sql." });
      }

      const playersRes = await sb
        .from("players")
        .select("id,username,display_name,is_admin");

      if (playersRes.error) return json(500, { error: playersRes.error.message });

      const playerMap = new Map();
      for (const p of playersRes.data || []) {
        playerMap.set(String(p.id), p);
      }

      const totals = new Map();
      for (const e of entriesRes.data || []) {
        const p = playerMap.get(String(e.player_id));
        if (!p || p.is_admin) continue;

        const activityType = String(e.activity_type || "run");
        const activity = activeActivityMap.get(activityType);
        if (!activity) continue;

        const km = Number(e.kilometers);
        const multiplier = Number(activity.multiplier);
        if (!Number.isFinite(km) || !Number.isFinite(multiplier)) continue;

        const equivalentKm = km * multiplier;
        const key = String(e.player_id);

        if (!totals.has(key)) {
          totals.set(key, {
            player_id: key,
            username: p.username || "",
            display_name: p.display_name || p.username || "Mängija",
            total_km: 0,
            actual_km: 0,
            entry_count: 0
          });
        }

        const row = totals.get(key);
        row.total_km += equivalentKm;
        row.actual_km += km;
        row.entry_count += 1;
      }

      const leaderboard = Array.from(totals.values())
        .map(row => ({
          ...row,
          total_km: Math.round(row.total_km * 100) / 100,
          actual_km: Math.round(row.actual_km * 100) / 100,
          goal_km: goalTotal,
          remaining_km: Math.max(0, Math.round((goalTotal - row.total_km) * 100) / 100),
          progress_percent: goalTotal > 0 ? Math.round((row.total_km / goalTotal) * 100) : 0
        }))
        .sort((a,b) => (b.total_km - a.total_km) || String(a.display_name).localeCompare(String(b.display_name), "et"));

      const myTotalRaw = totals.get(String(u.id))?.total_km || 0;
      const myTotal = Math.round(myTotalRaw * 100) / 100;

      const recent_entries = (entriesRes.data || [])
        .map(e => {
          const p = playerMap.get(String(e.player_id));
          if (!p || p.is_admin) return null;

          const activityType = String(e.activity_type || "run");
          const activity = activeActivityMap.get(activityType);
          if (!activity) return null;

          const km = Number(e.kilometers);
          const multiplier = Number(activity.multiplier);
          const equivalentKm = Number.isFinite(km) && Number.isFinite(multiplier) ? Math.round(km * multiplier * 100) / 100 : 0;

          return {
            id: e.id,
            player_id: e.player_id,
            display_name: p.display_name || p.username || "Mängija",
            activity_type: activityType,
            activity_label: activity.label || "Tegevus",
            activity_multiplier: multiplier,
            run_date: e.run_date,
            kilometers: km,
            equivalent_km: equivalentKm,
            note: e.note || "",
            created_at: e.created_at
          };
        })
        .filter(Boolean)
        .slice(0, 12);

      const my_entries = (entriesRes.data || [])
        .filter(e => String(e.player_id) === String(u.id))
        .map(e => {
          const type = String(e.activity_type || "run");
          const activity = activeActivityMap.get(type);
          if (!activity) return null;

          const km = Number(e.kilometers);
          const multiplier = Number(activity.multiplier);
          return {
            id: e.id,
            activity_type: type,
            activity_label: activity.label || "Tegevus",
            activity_multiplier: multiplier,
            run_date: e.run_date,
            kilometers: km,
            equivalent_km: Number.isFinite(km) && Number.isFinite(multiplier) ? Math.round(km * multiplier * 100) / 100 : 0,
            note: e.note || "",
            created_at: e.created_at
          };
        })
        .filter(Boolean)
        .slice(0, 20);

      return json(200, {
        ok: true,
        goal_total: goalTotal,
        my_total_km: myTotal,
        my_remaining_km: Math.max(0, Math.round((goalTotal - myTotal) * 100) / 100),
        my_progress_percent: goalTotal > 0 ? Math.round((myTotal / goalTotal) * 100) : 0,
        activities: activeActivities.map(a => ({
          code: a.code,
          label: a.label,
          multiplier: Number(a.multiplier),
          is_active: !!a.is_active,
          sort_order: a.sort_order
        })),
        leaderboard,
        recent_entries,
        my_entries
      });
    }

    if (event.httpMethod === "POST" && route === "running/entries") {
      const u = await freshUserFrom(sb, event);
      if (!u) return json(401, { error: "Pole sisse logitud." });

      const body = JSON.parse(event.body || "{}");
      const run_date = String(body.run_date || "").trim();
      const kmRaw = String(body.kilometers ?? "").trim().replace(",", ".");
      const kilometers = Number(kmRaw);
      const note = String(body.note || "").trim();
      const activity_type = String(body.activity_type || "").trim();

      const activityRes = await sb
        .from("running_activity_types")
        .select("code,label,multiplier,is_active")
        .eq("code", activity_type)
        .eq("is_active", true)
        .single();

      if (activityRes.error || !activityRes.data) {
        return json(400, { error: "Valitud tegevus ei ole lubatud." });
      }

      const activity_multiplier = Number(activityRes.data.multiplier);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(run_date)) {
        return json(400, { error: "Kuupäev peab olema formaadis YYYY-MM-DD." });
      }

      const parsedDate = new Date(`${run_date}T00:00:00Z`);
      if (!Number.isFinite(parsedDate.getTime())) {
        return json(400, { error: "Kuupäev on vigane." });
      }

      if (!Number.isFinite(kilometers) || kilometers <= 0 || kilometers > 200) {
        return json(400, { error: "Kilomeetrid peavad olema suuremad kui 0 ja kuni 200." });
      }

      if (!Number.isFinite(activity_multiplier) || activity_multiplier <= 0) {
        return json(400, { error: "Tegevuse koefitsient on vigane." });
      }

      if (note.length > 500) {
        return json(400, { error: "Kommentaar on liiga pikk." });
      }

      const ins = await sb
        .from("running_entries")
        .insert({
          player_id: u.id,
          activity_type,
          activity_multiplier,
          run_date,
          kilometers: Math.round(kilometers * 100) / 100,
          note: note || null
        })
        .select("id,player_id,activity_type,activity_multiplier,run_date,kilometers,note,created_at")
        .single();

      if (ins.error) {
        return json(500, { error: ins.error.message + " Käivita Supabase SQL Editoris sql/running_entries.sql." });
      }

      return json(200, { ok: true, entry: ins.data });
    }

    if (event.httpMethod === "GET" && route === "admin/running/activities") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      const q = await sb
        .from("running_activity_types")
        .select("code,label,multiplier,is_active,sort_order,updated_at")
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });

      if (q.error) return json(500, { error: q.error.message + " Käivita Supabase SQL Editoris sql/running_entries.sql." });

      return json(200, {
        ok: true,
        activities: (q.data || []).map(a => ({
          code: a.code,
          label: a.label,
          multiplier: Number(a.multiplier),
          is_active: !!a.is_active,
          sort_order: a.sort_order,
          updated_at: a.updated_at
        }))
      });
    }

    if (event.httpMethod === "POST" && route === "admin/running/activities") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      const body = JSON.parse(event.body || "{}");
      const label = String(body.label || "").trim();
      const codeRaw = String(body.code || label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const code = codeRaw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
      const multiplier = Number(String(body.multiplier ?? "").replace(",", "."));
      const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100;
      const is_active = body.is_active !== false;

      if (!code || !label) return json(400, { error: "Sisesta tegevuse nimi." });
      if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 100) return json(400, { error: "Koefitsient peab olema suurem kui 0 ja kuni 100." });

      const ins = await sb
        .from("running_activity_types")
        .insert({
          code,
          label,
          multiplier: Math.round(multiplier * 100) / 100,
          is_active,
          sort_order,
          updated_at: new Date().toISOString()
        })
        .select("code,label,multiplier,is_active,sort_order,updated_at")
        .single();

      if (ins.error) return json(500, { error: ins.error.message });

      return json(200, { ok: true, activity: ins.data });
    }

    const runningActivityUpdate = route.match(/^admin\/running\/activities\/([a-z0-9_]+)$/);
    if (runningActivityUpdate && event.httpMethod === "PUT") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      const code = runningActivityUpdate[1];
      const body = JSON.parse(event.body || "{}");
      const label = String(body.label || "").trim();
      const multiplier = Number(String(body.multiplier ?? "").replace(",", "."));
      const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100;
      const is_active = !!body.is_active;

      if (!label) return json(400, { error: "Sisesta tegevuse nimi." });
      if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 100) return json(400, { error: "Koefitsient peab olema suurem kui 0 ja kuni 100." });

      const upd = await sb
        .from("running_activity_types")
        .update({
          label,
          multiplier: Math.round(multiplier * 100) / 100,
          is_active,
          sort_order,
          updated_at: new Date().toISOString()
        })
        .eq("code", code)
        .select("code,label,multiplier,is_active,sort_order,updated_at")
        .single();

      if (upd.error) return json(500, { error: upd.error.message });

      return json(200, { ok: true, activity: upd.data });
    }


    if (event.httpMethod === "GET" && route === "beer/summary") {
      const u = await freshUserFrom(sb, event);
      if (!u) return json(401, { error: "Pole sisse logitud." });

      const entriesRes = await sb
        .from("beer_entries")
        .select("id,player_id,beer_size_liters,beer_count,total_liters,created_at")
        .order("created_at", { ascending: false });

      if (entriesRes.error) {
        return json(500, { error: entriesRes.error.message + " Käivita Supabase SQL Editoris sql/beer_counter.sql." });
      }

      const playersRes = await sb
        .from("players")
        .select("id,username,display_name,is_admin");

      if (playersRes.error) return json(500, { error: playersRes.error.message });

      const playerMap = new Map();
      for (const p of playersRes.data || []) {
        playerMap.set(String(p.id), p);
      }

      const totals = new Map();
      const sizeTotals = new Map();
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const last24Start = now - dayMs;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();

      let communityLiters = 0;
      let communityCount = 0;
      const last24Totals = new Map();

      for (const e of entriesRes.data || []) {
        const p = playerMap.get(String(e.player_id));
        if (!p) continue;

        const liters = Number(e.total_liters);
        const count = Number(e.beer_count);
        const size = Number(e.beer_size_liters);
        const createdTime = e.created_at ? new Date(e.created_at).getTime() : 0;

        if (!Number.isFinite(liters) || !Number.isFinite(count) || count <= 0) continue;

        communityLiters += liters;
        communityCount += count;

        const key = String(e.player_id);
        if (!totals.has(key)) {
          totals.set(key, {
            player_id: key,
            username: p.username || "",
            display_name: p.display_name || p.username || "Mängija",
            beer_count: 0,
            total_liters: 0,
            today_liters: 0,
            today_count: 0
          });
        }

        const row = totals.get(key);
        row.beer_count += count;
        row.total_liters += liters;

        if (Number.isFinite(createdTime) && createdTime >= todayStart) {
          row.today_liters += liters;
          row.today_count += count;
        }

        if (Number.isFinite(createdTime) && createdTime >= last24Start) {
          if (!last24Totals.has(key)) {
            last24Totals.set(key, {
              player_id: key,
              display_name: p.display_name || p.username || "Mängija",
              liters: 0,
              count: 0
            });
          }
          const h = last24Totals.get(key);
          h.liters += liters;
          h.count += count;
        }

        if (Number.isFinite(size)) {
          const sizeKey = size.toFixed(2);
          sizeTotals.set(sizeKey, (sizeTotals.get(sizeKey) || 0) + count);
        }
      }

      const leaderboard = Array.from(totals.values())
        .map(row => ({
          ...row,
          beer_count: Math.round(row.beer_count),
          total_liters: Math.round(row.total_liters * 100) / 100,
          today_liters: Math.round(row.today_liters * 100) / 100,
          today_count: Math.round(row.today_count)
        }))
        .sort((a,b) => (b.total_liters - a.total_liters) || (b.beer_count - a.beer_count) || String(a.display_name).localeCompare(String(b.display_name), "et"));

      let myRank = null;
      leaderboard.forEach((row, idx) => {
        row.rank = idx + 1;
        if (String(row.player_id) === String(u.id)) myRank = idx + 1;
      });

      const myRow = leaderboard.find(row => String(row.player_id) === String(u.id)) || {
        beer_count: 0,
        total_liters: 0,
        today_liters: 0,
        today_count: 0
      };

      const mvp = leaderboard[0] || null;
      const last24Leader = Array.from(last24Totals.values())
        .map(row => ({
          ...row,
          liters: Math.round(row.liters * 100) / 100,
          count: Math.round(row.count)
        }))
        .sort((a,b) => (b.liters - a.liters) || (b.count - a.count) || String(a.display_name).localeCompare(String(b.display_name), "et"))[0] || null;

      const popularSize = Array.from(sizeTotals.entries())
        .map(([size, count]) => ({ size_liters: Number(size), beer_count: count }))
        .sort((a,b) => (b.beer_count - a.beer_count) || (b.size_liters - a.size_liters))[0] || null;

      const recent_entries = (entriesRes.data || [])
        .map(e => {
          const p = playerMap.get(String(e.player_id));
          if (!p) return null;

          return {
            id: e.id,
            player_id: e.player_id,
            display_name: p.display_name || p.username || "Mängija",
            beer_size_liters: Number(e.beer_size_liters),
            beer_count: Number(e.beer_count),
            total_liters: Number(e.total_liters),
            created_at: e.created_at
          };
        })
        .filter(Boolean)
        .slice(0, 12);

      return json(200, {
        ok: true,
        community_liters: Math.round(communityLiters * 100) / 100,
        community_count: Math.round(communityCount),
        my_rank: myRank,
        my_beer_count: Math.round(myRow.beer_count || 0),
        my_total_liters: Math.round(Number(myRow.total_liters || 0) * 100) / 100,
        my_today_liters: Math.round(Number(myRow.today_liters || 0) * 100) / 100,
        my_today_count: Math.round(myRow.today_count || 0),
        mvp,
        last24_leader: last24Leader,
        popular_size: popularSize,
        leaderboard,
        recent_entries
      });
    }

    if (event.httpMethod === "POST" && route === "beer/entries") {
      const u = await freshUserFrom(sb, event);
      if (!u) return json(401, { error: "Pole sisse logitud." });

      const body = JSON.parse(event.body || "{}");
      const beer_size_liters = Number(String(body.beer_size_liters ?? "").replace(",", "."));
      const beer_count = Math.round(Number(body.beer_count || 1));

      const allowedSizes = [0.33, 0.5];
      const sizeOk = allowedSizes.some(x => Math.abs(x - beer_size_liters) < 0.001);
      if (!sizeOk) return json(400, { error: "Vali õlle suuruseks 0,33 L või 0,5 L." });

      if (!Number.isFinite(beer_count) || beer_count < 1 || beer_count > 24) {
        return json(400, { error: "Õllede arv peab olema 1 kuni 24." });
      }

      const total_liters = Math.round(beer_size_liters * beer_count * 100) / 100;

      const ins = await sb
        .from("beer_entries")
        .insert({
          player_id: u.id,
          beer_size_liters,
          beer_count,
          total_liters
        })
        .select("id,player_id,beer_size_liters,beer_count,total_liters,created_at")
        .single();

      if (ins.error) {
        return json(500, { error: ins.error.message + " Käivita Supabase SQL Editoris sql/beer_counter.sql." });
      }

      return json(200, { ok: true, entry: ins.data });
    }


// Admin players CRUD
    if (event.httpMethod === "GET" && route === "admin/players") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });
      const q = await sb.from("players").select("id,username,display_name,is_admin,created_at").order("created_at", { ascending: true });
      if (q.error) return json(500, { error: q.error.message });
      return json(200, { ok: true, players: q.data });
    }

    if (event.httpMethod === "POST" && route === "admin/players") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });
      const body = JSON.parse(event.body || "{}");
      const username = (body.username || "").toString().trim();
      const display_name = (body.display_name || username).toString().trim();
      const password = (body.password || "").toString();
      const is_admin = !!body.is_admin;
      if (!username || password.length < 6) return json(400, { error: "Puudub username või parool (min 6)." });
      const password_hash = await bcrypt.hash(password, 10);
      const ins = await sb.from("players").insert({ username, display_name, password_hash, is_admin }).select("id,username,display_name,is_admin").single();
      if (ins.error) return json(500, { error: ins.error.message });
      return json(200, { ok: true, player: ins.data });
    }

    const pu = route.match(/^admin\/players\/([0-9a-fA-F-]+)$/);
    if (pu && event.httpMethod === "PUT") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });
      const id = pu[1];
      const body = JSON.parse(event.body || "{}");
      const patch = {};
      if (body.username !== undefined) {
        const username = String(body.username).trim();
        if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
          return json(400, { error: "Kasutajanimi peab olema 3 kuni 32 märki ja sisaldama ainult tähti, numbreid, punkti, alakriipsu või sidekriipsu." });
        }
        patch.username = username;
      }
      if (body.display_name !== undefined) {
        const display_name = String(body.display_name).trim();
        if (!display_name) return json(400, { error: "Mängija nimi ei tohi olla tühi." });
        patch.display_name = display_name;
      }
      if (body.is_admin !== undefined) patch.is_admin = !!body.is_admin;
      if (body.password) {
        if (String(body.password).length < 6) return json(400, { error: "Parool peab olema vähemalt 6 märki." });
        patch.password_hash = await bcrypt.hash(String(body.password), 10);
      }
      if (!Object.keys(patch).length) return json(400, { error: "Midagi ei muudetud." });
      const upd = await sb.from("players").update(patch).eq("id", id).select("id,username,display_name,is_admin").single();
      if (upd.error) return json(500, { error: upd.error.message });
      return json(200, { ok: true, player: upd.data });
    }

    if (pu && event.httpMethod === "DELETE") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });
      const id = pu[1];
      const del = await sb.from("players").delete().eq("id", id);
      if (del.error) return json(500, { error: del.error.message });
      return json(200, { ok: true });
    }

    return json(404, { error: "Not found", route, method: event.httpMethod });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }

}

async function apiAdapter(req, res) {
  try {
    const result = await netlifyHandler(makeEvent(req));
    const statusCode = result && result.statusCode ? result.statusCode : 200;
    const headers = (result && result.headers) || {};
    for (const [k, v] of Object.entries(headers)) {
      if (v !== undefined) res.setHeader(k, v);
    }
    const body = result && result.body !== undefined ? result.body : "";
    res.status(statusCode).send(body);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}

app.all("/api", apiAdapter);
app.all("/api/*", apiAdapter);
app.all("/.netlify/functions/api", apiAdapter);
app.all("/.netlify/functions/api/*", apiAdapter);

app.use(express.static(path.join(__dirname, "frontend")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Võhma Lihakombinaadi ennustusvõistlus MM 2026 server töötab pordil ${PORT}`);
});
