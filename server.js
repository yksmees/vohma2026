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


const SEED_MATCHES = [{"stage": "Group A", "match_no": 1, "kickoff_utc": "2026-06-11T19:00:00Z", "home": "Mexico", "away": "South Africa", "location": "Estadio Azteca, Mexico City"}, {"stage": "Group A", "match_no": 2, "kickoff_utc": "2026-06-12T02:00:00Z", "home": "South Korea", "away": "Czechia", "location": "Estadio Akron, Zapopan"}, {"stage": "Group B", "match_no": 3, "kickoff_utc": "2026-06-12T19:00:00Z", "home": "Canada", "away": "Bosnia and Herzegovina", "location": "BMO Field, Toronto"}, {"stage": "Group D", "match_no": 4, "kickoff_utc": "2026-06-13T01:00:00Z", "home": "United States", "away": "Paraguay", "location": "SoFi Stadium, Inglewood"}, {"stage": "Group C", "match_no": 5, "kickoff_utc": "2026-06-14T01:00:00Z", "home": "Haiti", "away": "Scotland", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group D", "match_no": 6, "kickoff_utc": "2026-06-14T03:59:00Z", "home": "Australia", "away": "Türkiye", "location": "BC Place, Vancouver"}, {"stage": "Group C", "match_no": 7, "kickoff_utc": "2026-06-13T22:00:00Z", "home": "Brazil", "away": "Morocco", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group B", "match_no": 8, "kickoff_utc": "2026-06-13T19:00:00Z", "home": "Qatar", "away": "Switzerland", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group E", "match_no": 9, "kickoff_utc": "2026-06-14T23:00:00Z", "home": "Ivory Coast", "away": "Ecuador", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group E", "match_no": 10, "kickoff_utc": "2026-06-14T17:00:00Z", "home": "Germany", "away": "Curacao", "location": "NRG Stadium, Houston"}, {"stage": "Group F", "match_no": 11, "kickoff_utc": "2026-06-14T20:00:00Z", "home": "Netherlands", "away": "Japan", "location": "AT&T Stadium, Arlington"}, {"stage": "Group F", "match_no": 12, "kickoff_utc": "2026-06-15T02:00:00Z", "home": "Sweden", "away": "Tunisia", "location": "Estadio BBVA, Guadalupe"}, {"stage": "Group H", "match_no": 13, "kickoff_utc": "2026-06-15T22:00:00Z", "home": "Saudi Arabia", "away": "Uruguay", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Group H", "match_no": 14, "kickoff_utc": "2026-06-15T16:00:00Z", "home": "Spain", "away": "Cape Verde", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Group G", "match_no": 15, "kickoff_utc": "2026-06-16T01:00:00Z", "home": "Iran", "away": "New Zealand", "location": "SoFi Stadium, Inglewood"}, {"stage": "Group G", "match_no": 16, "kickoff_utc": "2026-06-15T19:00:00Z", "home": "Belgium", "away": "Egypt", "location": "Lumen Field, Seattle"}, {"stage": "Group I", "match_no": 17, "kickoff_utc": "2026-06-16T19:00:00Z", "home": "France", "away": "Senegal", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group I", "match_no": 18, "kickoff_utc": "2026-06-16T22:00:00Z", "home": "Iraq", "away": "Norway", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group J", "match_no": 19, "kickoff_utc": "2026-06-17T01:00:00Z", "home": "Argentina", "away": "Algeria", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Group J", "match_no": 20, "kickoff_utc": "2026-06-17T03:59:00Z", "home": "Austria", "away": "Jordan", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group L", "match_no": 21, "kickoff_utc": "2026-06-17T20:00:00Z", "home": "England", "away": "Croatia", "location": "AT&T Stadium, Arlington"}, {"stage": "Group L", "match_no": 22, "kickoff_utc": "2026-06-17T23:00:00Z", "home": "Ghana", "away": "Panama", "location": "BMO Field, Toronto"}, {"stage": "Group K", "match_no": 23, "kickoff_utc": "2026-06-17T17:00:00Z", "home": "Portugal", "away": "Congo DR", "location": "NRG Stadium, Houston"}, {"stage": "Group K", "match_no": 24, "kickoff_utc": "2026-06-18T02:00:00Z", "home": "Uzbekistan", "away": "Colombia", "location": "Estadio Azteca, Mexico City"}, {"stage": "Group A", "match_no": 25, "kickoff_utc": "2026-06-18T16:00:00Z", "home": "Czechia", "away": "South Africa", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Group B", "match_no": 26, "kickoff_utc": "2026-06-18T19:00:00Z", "home": "Switzerland", "away": "Bosnia and Herzegovina", "location": "SoFi Stadium, Inglewood"}, {"stage": "Group B", "match_no": 27, "kickoff_utc": "2026-06-18T22:00:00Z", "home": "Canada", "away": "Qatar", "location": "BC Place, Vancouver"}, {"stage": "Group A", "match_no": 28, "kickoff_utc": "2026-06-19T01:00:00Z", "home": "Mexico", "away": "South Korea", "location": "Estadio Akron, Zapopan"}, {"stage": "Group C", "match_no": 29, "kickoff_utc": "2026-06-20T01:00:00Z", "home": "Brazil", "away": "Haiti", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group C", "match_no": 30, "kickoff_utc": "2026-06-19T22:00:00Z", "home": "Scotland", "away": "Morocco", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group D", "match_no": 31, "kickoff_utc": "2026-06-20T03:59:00Z", "home": "Türkiye", "away": "Paraguay", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group D", "match_no": 32, "kickoff_utc": "2026-06-19T19:00:00Z", "home": "United States", "away": "Australia", "location": "Lumen Field, Seattle"}, {"stage": "Group E", "match_no": 33, "kickoff_utc": "2026-06-20T20:00:00Z", "home": "Germany", "away": "Ivory Coast", "location": "BMO Field, Toronto"}, {"stage": "Group E", "match_no": 34, "kickoff_utc": "2026-06-21T00:00:00Z", "home": "Ecuador", "away": "Curacao", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Group F", "match_no": 35, "kickoff_utc": "2026-06-20T17:00:00Z", "home": "Netherlands", "away": "Sweden", "location": "NRG Stadium, Houston"}, {"stage": "Group F", "match_no": 36, "kickoff_utc": "2026-06-21T03:59:00Z", "home": "Tunisia", "away": "Japan", "location": "Estadio BBVA, Guadalupe"}, {"stage": "Group H", "match_no": 37, "kickoff_utc": "2026-06-21T22:00:00Z", "home": "Uruguay", "away": "Cape Verde", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Group H", "match_no": 38, "kickoff_utc": "2026-06-21T16:00:00Z", "home": "Spain", "away": "Saudi Arabia", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Group G", "match_no": 39, "kickoff_utc": "2026-06-21T19:00:00Z", "home": "Belgium", "away": "Iran", "location": "Sofi Stadium, Inglewood"}, {"stage": "Group G", "match_no": 40, "kickoff_utc": "2026-06-22T01:00:00Z", "home": "New Zealand", "away": "Egypt", "location": "BC Place, Vancouver"}, {"stage": "Group I", "match_no": 41, "kickoff_utc": "2026-06-23T00:00:00Z", "home": "Norway", "away": "Senegal", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group I", "match_no": 42, "kickoff_utc": "2026-06-22T21:00:00Z", "home": "France", "away": "Iraq", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group J", "match_no": 43, "kickoff_utc": "2026-06-22T17:00:00Z", "home": "Argentina", "away": "Austria", "location": "AT&T Stadium, Arlington"}, {"stage": "Group J", "match_no": 44, "kickoff_utc": "2026-06-23T03:00:00Z", "home": "Jordan", "away": "Algeria", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group L", "match_no": 45, "kickoff_utc": "2026-06-23T20:00:00Z", "home": "England", "away": "Ghana", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group L", "match_no": 46, "kickoff_utc": "2026-06-23T23:00:00Z", "home": "Panama", "away": "Croatia", "location": "BMO Field, Toronto"}, {"stage": "Group K", "match_no": 47, "kickoff_utc": "2026-06-23T17:00:00Z", "home": "Portugal", "away": "Uzbekistan", "location": "NRG Stadium, Houston"}, {"stage": "Group K", "match_no": 48, "kickoff_utc": "2026-06-24T02:00:00Z", "home": "Colombia", "away": "Congo DR", "location": "Estadio Akron, Zapopan"}, {"stage": "Group C", "match_no": 49, "kickoff_utc": "2026-06-24T22:00:00Z", "home": "Scotland", "away": "Brazil", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Group C", "match_no": 50, "kickoff_utc": "2026-06-24T22:00:00Z", "home": "Morocco", "away": "Haiti", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Group B", "match_no": 51, "kickoff_utc": "2026-06-24T19:00:00Z", "home": "Switzerland", "away": "Canada", "location": "BC Place, Vancouver"}, {"stage": "Group B", "match_no": 52, "kickoff_utc": "2026-06-24T19:00:00Z", "home": "Bosnia and Herzegovina", "away": "Qatar", "location": "Lumen Field, Seattle"}, {"stage": "Group A", "match_no": 53, "kickoff_utc": "2026-06-25T01:00:00Z", "home": "Czechia", "away": "Mexico", "location": "Estadio Azteca, Mexico City"}, {"stage": "Group A", "match_no": 54, "kickoff_utc": "2026-06-25T01:00:00Z", "home": "South Africa", "away": "South Korea", "location": "Estadio BBVA, Guadalupe"}, {"stage": "Group E", "match_no": 55, "kickoff_utc": "2026-06-25T20:00:00Z", "home": "Curacao", "away": "Ivory Coast", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group E", "match_no": 56, "kickoff_utc": "2026-06-25T20:00:00Z", "home": "Ecuador", "away": "Germany", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group F", "match_no": 57, "kickoff_utc": "2026-06-25T23:00:00Z", "home": "Japan", "away": "Sweden", "location": "AT&T Stadium, Arlington"}, {"stage": "Group F", "match_no": 58, "kickoff_utc": "2026-06-25T23:00:00Z", "home": "Tunisia", "away": "Netherlands", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Group D", "match_no": 59, "kickoff_utc": "2026-06-26T02:00:00Z", "home": "Türkiye", "away": "United States", "location": "SoFi Stadium, Inglewood"}, {"stage": "Group D", "match_no": 60, "kickoff_utc": "2026-06-26T02:00:00Z", "home": "Paraguay", "away": "Australia", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Group I", "match_no": 61, "kickoff_utc": "2026-06-26T19:00:00Z", "home": "Norway", "away": "France", "location": "Gillette Stadium, Foxborough"}, {"stage": "Group I", "match_no": 62, "kickoff_utc": "2026-06-26T19:00:00Z", "home": "Senegal", "away": "Iraq", "location": "BMO Field, Toronto"}, {"stage": "Group G", "match_no": 63, "kickoff_utc": "2026-06-27T03:00:00Z", "home": "Egypt", "away": "Iran", "location": "Lumen Field, Seattle"}, {"stage": "Group G", "match_no": 64, "kickoff_utc": "2026-06-27T03:00:00Z", "home": "New Zealand", "away": "Belgium", "location": "BC Place, Vancouver"}, {"stage": "Group H", "match_no": 65, "kickoff_utc": "2026-06-27T00:00:00Z", "home": "Cape Verde", "away": "Saudi Arabia", "location": "NRG Stadium, Houston"}, {"stage": "Group H", "match_no": 66, "kickoff_utc": "2026-06-27T00:00:00Z", "home": "Uruguay", "away": "Spain", "location": "Estadio Akron, Zapopan"}, {"stage": "Group L", "match_no": 67, "kickoff_utc": "2026-06-27T21:00:00Z", "home": "Panama", "away": "England", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Group L", "match_no": 68, "kickoff_utc": "2026-06-27T21:00:00Z", "home": "Croatia", "away": "Ghana", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Group J", "match_no": 69, "kickoff_utc": "2026-06-28T02:00:00Z", "home": "Algeria", "away": "Austria", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Group J", "match_no": 70, "kickoff_utc": "2026-06-28T02:00:00Z", "home": "Jordan", "away": "Argentina", "location": "AT&T Stadium, Arlington"}, {"stage": "Group K", "match_no": 71, "kickoff_utc": "2026-06-27T23:30:00Z", "home": "Colombia", "away": "Portugal", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Group K", "match_no": 72, "kickoff_utc": "2026-06-27T23:30:00Z", "home": "Congo DR", "away": "Uzbekistan", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Round of 32", "match_no": 73, "kickoff_utc": "2026-06-28T19:00:00Z", "home": "2A", "away": "2B", "location": "Sofi Stadium, Inglewood"}, {"stage": "Round of 32", "match_no": 74, "kickoff_utc": "2026-06-29T20:30:00Z", "home": "1E", "away": "3ABCDF", "location": "Gillette Stadium, Foxborough"}, {"stage": "Round of 32", "match_no": 75, "kickoff_utc": "2026-06-30T01:00:00Z", "home": "1F", "away": "2C", "location": "Estadio BBVA, Guadalupe"}, {"stage": "Round of 32", "match_no": 76, "kickoff_utc": "2026-06-29T17:00:00Z", "home": "1C", "away": "2F", "location": "NRG Stadium, Houston"}, {"stage": "Round of 32", "match_no": 77, "kickoff_utc": "2026-06-30T21:00:00Z", "home": "1I", "away": "3CDFGH", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Round of 32", "match_no": 78, "kickoff_utc": "2026-06-30T18:00:00Z", "home": "2E", "away": "2I", "location": "AT&T Stadium, Arlington"}, {"stage": "Round of 32", "match_no": 79, "kickoff_utc": "2026-07-01T01:00:00Z", "home": "1A", "away": "3CEFHI", "location": "Estadio Azteca, Mexico City"}, {"stage": "Round of 32", "match_no": 80, "kickoff_utc": "2026-07-01T16:00:00Z", "home": "1L", "away": "3EHIJK", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Round of 32", "match_no": 81, "kickoff_utc": "2026-07-02T00:00:00Z", "home": "1D", "away": "3BEFIJ", "location": "Levi's Stadium, Santa Clara"}, {"stage": "Round of 32", "match_no": 82, "kickoff_utc": "2026-07-01T20:00:00Z", "home": "1G", "away": "3AEHIJ", "location": "Lumen Field, Seattle"}, {"stage": "Round of 32", "match_no": 83, "kickoff_utc": "2026-07-02T23:00:00Z", "home": "2K", "away": "2L", "location": "BMO Field, Toronto"}, {"stage": "Round of 32", "match_no": 84, "kickoff_utc": "2026-07-02T19:00:00Z", "home": "1H", "away": "2J", "location": "Sofi Stadium, Inglewood"}, {"stage": "Round of 32", "match_no": 85, "kickoff_utc": "2026-07-03T03:00:00Z", "home": "2B", "away": "3EFGIJ", "location": "BC Place, Vancouver"}, {"stage": "Round of 32", "match_no": 86, "kickoff_utc": "2026-07-03T22:00:00Z", "home": "1J", "away": "2H", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Round of 32", "match_no": 87, "kickoff_utc": "2026-07-04T01:30:00Z", "home": "1K", "away": "3DEIJL", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Round of 32", "match_no": 88, "kickoff_utc": "2026-07-03T18:00:00Z", "home": "2D", "away": "2G", "location": "AT&T Stadium, Arlington"}, {"stage": "Round of 16", "match_no": 89, "kickoff_utc": "2026-07-04T21:00:00Z", "home": "W74", "away": "W77", "location": "Lincoln Financial Field, Philadelphia"}, {"stage": "Round of 16", "match_no": 90, "kickoff_utc": "2026-07-04T17:00:00Z", "home": "W73", "away": "W75", "location": "NRG Stadium, Houston"}, {"stage": "Round of 16", "match_no": 91, "kickoff_utc": "2026-07-05T20:00:00Z", "home": "W76", "away": "W78", "location": "MetLife Stadium, East Rutherford"}, {"stage": "Round of 16", "match_no": 92, "kickoff_utc": "2026-07-06T00:00:00Z", "home": "W79", "away": "W80", "location": "Estadio Azteca, Mexico City"}, {"stage": "Round of 16", "match_no": 93, "kickoff_utc": "2026-07-06T19:00:00Z", "home": "W83", "away": "W84", "location": "AT&T Stadium, Arlington"}, {"stage": "Round of 16", "match_no": 94, "kickoff_utc": "2026-07-07T00:00:00Z", "home": "W81", "away": "W82", "location": "Lumen Field, Seattle"}, {"stage": "Round of 16", "match_no": 95, "kickoff_utc": "2026-07-07T16:00:00Z", "home": "W86", "away": "W88", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Round of 16", "match_no": 96, "kickoff_utc": "2026-07-07T20:00:00Z", "home": "W85", "away": "W87", "location": "BC Place, Vancouver"}, {"stage": "Quarterfinals", "match_no": 97, "kickoff_utc": "2026-07-09T20:00:00Z", "home": "W89", "away": "W90", "location": "Gillette Stadium, Foxborough"}, {"stage": "Quarterfinals", "match_no": 98, "kickoff_utc": "2026-07-10T19:00:00Z", "home": "W93", "away": "W94", "location": "Sofi Stadium, Inglewood"}, {"stage": "Quarterfinals", "match_no": 99, "kickoff_utc": "2026-07-11T21:00:00Z", "home": "W91", "away": "W92", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Quarterfinals", "match_no": 100, "kickoff_utc": "2026-07-12T01:00:00Z", "home": "W95", "away": "W96", "location": "Arrowhead Stadium, Kansas City"}, {"stage": "Semifinals", "match_no": 101, "kickoff_utc": "2026-07-14T19:00:00Z", "home": "W97", "away": "W98", "location": "AT&T Stadium, Arlington"}, {"stage": "Semifinals", "match_no": 102, "kickoff_utc": "2026-07-15T19:00:00Z", "home": "W99", "away": "W100", "location": "Mercedes-Benz Stadium, Atlanta"}, {"stage": "Third Place", "match_no": 103, "kickoff_utc": "2026-07-18T21:00:00Z", "home": "L101", "away": "L102", "location": "Hard Rock Stadium, Miami Gardens"}, {"stage": "Final", "match_no": 104, "kickoff_utc": "2026-07-19T19:00:00Z", "home": "W101", "away": "W102", "location": "MetLife Stadium, East Rutherford"}];



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
  const predictedWinner = predictedAdvancerFromPrediction(ph, pa, options.pred_winner);

  if (
    playoff &&
    actualWinner &&
    predictedWinner &&
    actualWinner === predictedWinner
  ) {
    points += 1;
  }

  return points;
}

const BONUS_QUESTIONS_SEED = [
  "Milline koondis tuleb maailmameistriks?",
  "Kes on turniiri suurim väravakütt?",
  "Mitu väravat lööb oma viimasel suurturniiril Messi?",
  "Mitu väravat lööb oma viimasel suurturniiril Ronaldo?",
  "Kes võidab meie alagrupiturniiri ennustuse?",
  "Kes jääb meie alagrupiturniiri ennustuses viimaseks?"
];

async function ensureBonusQuestions(sb){
  const existing = await sb
    .from("bonus_questions")
    .select("id,question_text,sort_order")
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
    const question_text = BONUS_QUESTIONS_SEED[i];
    const row = current.find(q => Number(q.sort_order) === sort_order);

    if (!row) {
      const ins = await sb.from("bonus_questions").insert({
        question_text,
        sort_order,
        points: 3,
        active: true
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

function isPlayoffMatchForLeaderboard(match){
  return isPlayoffMatch(match) && !isGroupMatchForLeaderboard(match);
}

function addRankMovement(current, previous){
  const previousRank = new Map();
  previous.forEach((row, index) => previousRank.set(row.player_id, index + 1));

  return current.map((row, index) => {
    const rank = index + 1;
    const prev = previousRank.get(row.player_id) || rank;
    return {
      ...row,
      rank,
      previous_rank: prev,
      movement: prev - rank
    };
  });
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

function apiFixtureFinished(fx){
  const short = fx?.fixture?.status?.short || "";
  return ["FT", "AET", "PEN", "AWD", "WO"].includes(short);
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

  const gh = fx?.goals?.home;
  const ga = fx?.goals?.away;
  if (gh !== null && ga !== null && gh !== undefined && ga !== undefined) {
    return { home: Number(gh), away: Number(ga) };
  }

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
    { raw: dbMatch.home, normalized: normalizeTeamName(dbMatch.home) },
    { raw: dbMatch.away, normalized: normalizeTeamName(dbMatch.away) }
  ].filter(t => t.normalized && !isPlaceholderTeam(t.raw));

  if (!dbTeams.length) return false;

  const apiTeams = [
    fx?.teams?.home?.name,
    fx?.teams?.away?.name
  ];

  return dbTeams.some(db => apiTeams.some(api => teamNamesMatch(db.normalized, api)));
}

function scoreFixtureMatch(dbMatch, fx){
  let score = 0;
  const dbKick = dbMatch.kickoff_utc ? new Date(dbMatch.kickoff_utc).getTime() : null;
  const fxKick = fx?.fixture?.date ? new Date(fx.fixture.date).getTime() : null;

  if (dbKick && fxKick){
    const diffMin = Math.abs(dbKick - fxKick) / 60000;
    if (diffMin <= 5) score += 6;
    else if (diffMin <= 30) score += 4;
    else if (diffMin <= 120) score += 2;
  }

  const dbHome = normalizeTeamName(dbMatch.home);
  const dbAway = normalizeTeamName(dbMatch.away);
  const fxHome = normalizeTeamName(fx?.teams?.home?.name);
  const fxAway = normalizeTeamName(fx?.teams?.away?.name);

  if (!isPlaceholderTeam(dbMatch.home) && dbHome && dbHome === fxHome) score += 3;
  if (!isPlaceholderTeam(dbMatch.away) && dbAway && dbAway === fxAway) score += 3;

  const venue = normalizeTeamName(dbMatch.location);
  const fxVenue = normalizeTeamName(fx?.fixture?.venue?.name);
  if (venue && fxVenue && (venue.includes(fxVenue) || fxVenue.includes(venue))) score += 2;

  const stage = normalizeTeamName(dbMatch.stage);
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

function chooseFixtureForMatch(dbMatch, fixtures){
  if (dbMatch.api_football_fixture_id){
    const exact = fixtures.find(fx => Number(fx?.fixture?.id) === Number(dbMatch.api_football_fixture_id));
    if (exact && fixtureHasTeamNameOverlap(dbMatch, exact)) return exact;
  }

  let best = null;
  let bestScore = -1;
  for (const fx of fixtures){
    if (!fixtureHasTeamNameOverlap(dbMatch, fx)) continue;

    const score = scoreFixtureMatch(dbMatch, fx);
    if (score > bestScore){
      best = fx;
      bestScore = score;
    }
  }
  return bestScore >= 4 ? best : null;
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
  const updates = [];

  for (const match of matches){
    let home = match.home;
    let away = match.away;

    const resolvedHome = resolvePlaceholderTeamName(home, byNo);
    const resolvedAway = resolvePlaceholderTeamName(away, byNo);

    if (resolvedHome) home = resolvedHome;
    if (resolvedAway) away = resolvedAway;

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


async function recalcPointsForMatch(sb, matchId){
  const matchRes = await sb.from("matches").select("*").eq("id", matchId).single();
  if (matchRes.error || !matchRes.data) return;

  const match = matchRes.data;
  const fh = match.final_home;
  const fa = match.final_away;
  if (fh===null || fa===null || fh===undefined || fa===undefined) return;

  const preds = await sb.from("predictions").select("id,pred_home,pred_away,pred_winner").eq("match_id", matchId);
  if (preds.error) return;

  for (const p of preds.data || []){
    const pts = calcPoints(p.pred_home, p.pred_away, fh, fa, {
      match,
      pred_winner: p.pred_winner
    });
    await sb.from("predictions").update({ points: pts }).eq("id", p.id);
  }
}

async function syncApiFootballResults(sb, { force=false } = {}){
  const now = Date.now();
  if (!force && now - lastApiFootballSyncAt < API_FOOTBALL_SYNC_COOLDOWN_MS){
    return { ok:true, skipped:true, updated:0, reason:"cooldown" };
  }
  lastApiFootballSyncAt = now;

  const matchesRes = await sb.from("matches").select("*").order("match_no", { ascending: true });
  if (matchesRes.error){
    return { ok:false, updated:0, error:matchesRes.error.message };
  }

  const matchDates = (matchesRes.data || [])
    .filter(m => !m.manual_result_override)
    .filter(m => {
      if (!m.kickoff_utc) return false;
      const t = new Date(m.kickoff_utc).getTime();
      return Number.isFinite(t) && t <= Date.now() + 24 * 60 * 60 * 1000;
    })
    .map(m => apiFootballDateOnly(m.kickoff_utc));

  const fetched = await fetchApiFootballFixtures(matchDates);
  if (!fetched.ok){
    return { ok:false, updated:0, error:fetched.error || "API-Football päring ebaõnnestus" };
  }

  const fixtures = fetched.fixtures || [];
  let updated = 0;
  let matched = 0;
  let finished_found = 0;
  let skipped_manual = 0;
  let update_errors = 0;
  const unmatched = [];
  const fixture_id_mismatches = [];
  const updated_matches = [];
  const update_error_examples = [];

  for (const match of matchesRes.data || []){
    if (match.manual_result_override) {
      skipped_manual += 1;
      continue;
    }

    if (match.api_football_fixture_id) {
      const exactFixture = fixtures.find(fx => Number(fx?.fixture?.id) === Number(match.api_football_fixture_id));
      if (exactFixture && !fixtureHasTeamNameOverlap(match, exactFixture)) {
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
      } catch (_) {
        // ignoreeri vabatahtliku veeru salvestuse viga
      }
    }

    if (apiFixtureFinished(fx)){
      finished_found += 1;

      const score = apiNormalTimeScore(fx);
      if (score && Number.isFinite(score.home) && Number.isFinite(score.away)){
        const homeGoals = score.home;
        const awayGoals = score.away;
        const apiWinner = apiFixtureWinner(fx);

        const changed =
          Number(match.final_home) !== homeGoals ||
          Number(match.final_away) !== awayGoals ||
          normalizeWinner(match.winner) !== apiWinner ||
          !match.is_finished;

        const resultPatch = {
          final_home: homeGoals,
          final_away: awayGoals,
          is_finished: true
        };
        if (apiWinner) resultPatch.winner = apiWinner;

        const upd = await sb.from("matches").update(resultPatch).eq("id", match.id).select("*").single();

        if (!upd.error){
          updated += 1;
          updated_matches.push(`#${match.match_no} ${match.home} - ${match.away} ${homeGoals}:${awayGoals}`);
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

  const derived = await updateDerivedPlayoffMatches(sb);

  return {
    ok:true,
    updated,
    fixtures: fixtures.length,
    matched,
    finished_found,
    skipped_manual,
    update_errors,
    derived_updates: derived.updated || 0,
    requested: fetched.requested || [],
    updated_matches: updated_matches.slice(0, 20),
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

    if (event.httpMethod === "GET" && route === "health") {
      return json(200, { ok: true, time: new Date().toISOString() });
    }

    const sb = sbAdmin();

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
      return json(200, { ok: true, matches: m.data });
    }


    // Admin API-Football debug: shows candidate fixtures for a match number
    if (event.httpMethod === "GET" && route === "admin/debug/api-football") {
      const u = await requireAdmin(sb, event);
      if (!u) return json(403, { error: "Admini õigused puuduvad." });

      const no = Number(event.queryStringParameters?.match_no || 0);
      if (!no) return json(400, { error: "Lisa query: ?match_no=..." });

      const matchRes = await sb.from("matches").select("*").eq("match_no", no).single();
      if (matchRes.error) return json(500, { error: matchRes.error.message });

      const date = apiFootballDateOnly(matchRes.data.kickoff_utc);
      const fetched = await fetchApiFootballFixtures(date ? [date] : []);
      if (!fetched.ok) return json(500, { error: fetched.error || "API-Football viga" });

      const candidates = (fetched.fixtures || [])
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
          manual_result_override: true
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
  if (body.final_home !== undefined || body.final_away !== undefined || body.winner !== undefined) patch.manual_result_override = true;
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
      if (body.final_home !== undefined || body.final_away !== undefined || body.winner !== undefined) body.manual_result_override = true;
      const upd = await sb.from("matches").update(body).eq("id", id).select("*").single();
      if (upd.error) return json(500, { error: upd.error.message });

      const fh = upd.data.final_home;
      const fa = upd.data.final_away;
      if (fh !== null && fa !== null && fh !== undefined && fa !== undefined) {
        await recalcPointsForMatch(sb, id);
        await updateDerivedPlayoffMatches(sb);
      }

      return json(200, { ok: true, match: upd.data });
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

  const matchesRes = await sb.from("matches").select("id,kickoff_utc,is_finished");
  if (matchesRes.error) return json(500, { error: matchesRes.error.message });

  const now = Date.now();
  const openMatchIds = [];
  for (const m of matchesRes.data || []) {
    const kickoff = m.kickoff_utc ? new Date(m.kickoff_utc).getTime() : null;
    const locked = m.is_finished || (kickoff && now >= (kickoff - 60 * 60 * 1000));
    if (locked) openMatchIds.push(m.id);
  }

  if (!openMatchIds.length) return json(200, { ok: true, predictions_by_match: {} });

  const predsRes = await sb
    .from("predictions")
    .select("match_id,player_id,pred_home,pred_away,pred_winner")
    .in("match_id", openMatchIds);

  if (predsRes.error) return json(500, { error: predsRes.error.message });

  const playersRes = await sb.from("players").select("id,display_name,is_admin");
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

  const playersRes = await sb
    .from("players")
    .select("id,display_name,is_admin,created_at")
    .order("display_name", { ascending: true });

  if (playersRes.error) return json(500, { error: playersRes.error.message });

  const matchesRes = await sb
    .from("matches")
    .select("id,match_no,stage,home,away,location,kickoff_utc,final_home,final_away,winner,is_finished")
    .order("match_no", { ascending: true });

  if (matchesRes.error) return json(500, { error: matchesRes.error.message });

  const now = Date.now();

  const visibleMatches = (matchesRes.data || []).filter(m => {
    const hasFinal =
      m.is_finished ||
      (
        m.final_home !== null &&
        m.final_home !== undefined &&
        m.final_away !== null &&
        m.final_away !== undefined
      );

    const kickoff = m.kickoff_utc ? new Date(m.kickoff_utc).getTime() : null;
    const locked = Number.isFinite(kickoff) && now >= (kickoff - 60 * 60 * 1000);

    return hasFinal || locked;
  }).sort((a,b) => {
    const ta = a.kickoff_utc ? new Date(a.kickoff_utc).getTime() : 0;
    const tb = b.kickoff_utc ? new Date(b.kickoff_utc).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (Number(b.match_no) || 0) - (Number(a.match_no) || 0);
  });

  const matchIds = visibleMatches.map(m => m.id);
  let predictions = [];

  if (matchIds.length) {
    const predsRes = await sb
      .from("predictions")
      .select("match_id,player_id,pred_home,pred_away,pred_winner,points")
      .in("match_id", matchIds);

    if (predsRes.error) return json(500, { error: predsRes.error.message });
    predictions = predsRes.data || [];
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
    .select("id,match_no,stage,final_home,final_away,winner,kickoff_utc")
    .eq("id", match_id)
    .single();

  if (m.error) return json(500, { error: m.error.message });

  if (!u.is_admin && m.data.kickoff_utc) {
    const kickoff = new Date(m.data.kickoff_utc).getTime();
    const lockAt = kickoff - 60 * 60 * 1000;
    const now = Date.now();
    if (Number.isFinite(kickoff) && now >= lockAt) {
      return json(403, { error: "Ennustus on lukus (lukustub 1 tund enne mängu algust)." });
    }
  }

  const playoff = isPlayoffMatch(m.data);
  const needsWinner = playoff && pred_home === pred_away;

  if (needsWinner && !pred_winner) {
    return json(400, { error: "Viigilise play-off ennustuse korral vali ka edasipääseja." });
  }

  const savedWinner = needsWinner ? pred_winner : null;

  const points = calcPoints(pred_home, pred_away, m.data.final_home, m.data.final_away, {
    match: m.data,
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
    .select("id,question_text,points,sort_order,active")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (questions.error) return json(500, { error: questions.error.message });

  const answers = await sb
    .from("bonus_answers")
    .select("question_id,answer_text,is_correct,points")
    .eq("player_id", u.sub);

  if (answers.error) return json(500, { error: answers.error.message });

  return json(200, {
    ok: true,
    ...lock,
    questions: questions.data || [],
    answers: answers.data || []
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

  const q = await sb.from("bonus_questions").select("id").eq("active", true);
  if (q.error) return json(500, { error: q.error.message });

  const validQuestionIds = new Set((q.data || []).map(x => Number(x.id)));

  const rows = answers
    .map(a => ({
      player_id: u.sub,
      question_id: Number(a.question_id),
      answer_text: String(a.answer_text || "").normalize("NFC").trim()
    }))
    .filter(a => Number.isFinite(a.question_id) && validQuestionIds.has(a.question_id));

  if (!rows.length) return json(400, { error: "Vastuseid ei leitud." });

  for (const row of rows) {
    const existing = await sb
      .from("bonus_answers")
      .select("is_correct,points")
      .eq("player_id", row.player_id)
      .eq("question_id", row.question_id)
      .maybeSingle();

    if (existing.error) return json(500, { error: existing.error.message });

    const payload = {
      ...row,
      is_correct: existing.data?.is_correct || false,
      points: existing.data?.points || 0
    };

    const up = await sb
      .from("bonus_answers")
      .upsert(payload, { onConflict: "player_id,question_id" });

    if (up.error) return json(500, { error: up.error.message });
  }

  const saved = await sb
    .from("bonus_answers")
    .select("question_id,answer_text,is_correct,points")
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
    .select("id,question_text,correct_answer,points,sort_order,active")
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
    .select("id,question_text,correct_answer,points,sort_order,active")
    .order("sort_order", { ascending: true });

  const players = await sb
    .from("players")
    .select("id,display_name,is_admin")
    .order("display_name", { ascending: true });

  const answers = await sb
    .from("bonus_answers")
    .select("player_id,question_id,answer_text,is_correct,points");

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
      points,
      sort_order,
      active: true
    })
    .select("id,question_text,correct_answer,points,sort_order,active")
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
    if (body.points !== undefined) patch.points = Number(body.points) || 3;
    if (body.active !== undefined) patch.active = !!body.active;
    if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order) || 0;

    if (!Object.keys(patch).length) return json(400, { error: "Muudatus puudub." });

    const upd = await sb.from("bonus_questions").update(patch).eq("id", id).select("*").single();
    if (upd.error) return json(500, { error: upd.error.message });

    return json(200, { ok: true, question: upd.data });
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
    .select("answer_text")
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
      is_correct,
      points
    }, { onConflict: "player_id,question_id" })
    .select("player_id,question_id,answer_text,is_correct,points")
    .single();

  if (upd.error) return json(500, { error: upd.error.message });

  return json(200, { ok: true, answer: upd.data });
}

// Admin: recalculate all prediction points using the current scoring rules
if (event.httpMethod === "POST" && route === "admin/recalc-points") {
  const u = await requireAdmin(sb, event);
  if (!u) return json(403, { error: "Admini õigused puuduvad." });

  const matches = await sb.from("matches").select("id");
  if (matches.error) return json(500, { error: matches.error.message });

  let updated_matches = 0;
  for (const m of matches.data || []) {
    await recalcPointsForMatch(sb, m.id);
    updated_matches += 1;
  }

  return json(200, { ok: true, updated_matches });
}


// Leaderboard
if (event.httpMethod === "GET" && route === "leaderboard") {
  const players = await sb.from("players").select("id,display_name,is_admin");
  const preds = await sb.from("predictions").select("player_id,match_id,points");
  const matches = await sb.from("matches").select("id,match_no,stage,is_finished,final_home,final_away").order("match_no", { ascending: true });
  const bonus = await sb.from("bonus_answers").select("player_id,points");

  if (players.error || preds.error || matches.error || bonus.error) {
    return json(500, { error: (players.error || preds.error || matches.error || bonus.error).message });
  }

  const allPlayers = (players.data || []).filter(p => !p.is_admin);
  const allPreds = preds.data || [];
  const allMatches = matches.data || [];
  const bonusMap = new Map();

  for (const b of bonus.data || []) {
    bonusMap.set(b.player_id, (bonusMap.get(b.player_id) || 0) + (Number(b.points) || 0));
  }

  const matchMap = new Map(allMatches.map(m => [m.id, m]));
  const finishedMatches = allMatches.filter(m =>
    m.is_finished ||
    (
      m.final_home !== null &&
      m.final_home !== undefined &&
      m.final_away !== null &&
      m.final_away !== undefined
    )
  ).sort((a,b)=>a.match_no-b.match_no);

  const groupFinished = finishedMatches.filter(isGroupMatchForLeaderboard);
  const playoffFinished = finishedMatches.filter(isPlayoffMatchForLeaderboard);

  const latestGroup = groupFinished.length ? groupFinished[groupFinished.length - 1] : null;
  const latestPlayoff = playoffFinished.length ? playoffFinished[playoffFinished.length - 1] : null;

  function makeRows(kind, excludeMatchId = null) {
    const map = new Map();

    for (const p of allPlayers) {
      map.set(p.id, {
        player_id: p.id,
        display_name: p.display_name,
        points: 0,
        match_points: 0,
        bonus_points: kind === "playoff" ? (bonusMap.get(p.id) || 0) : 0
      });
    }

    for (const pr of allPreds) {
      if (excludeMatchId && pr.match_id === excludeMatchId) continue;

      const match = matchMap.get(pr.match_id);
      if (!match) continue;

      const include =
        kind === "group"
          ? isGroupMatchForLeaderboard(match)
          : isPlayoffMatchForLeaderboard(match);

      if (!include) continue;

      const row = map.get(pr.player_id);
      if (row) {
        row.match_points += (Number(pr.points) || 0);
      }
    }

    for (const row of map.values()) {
      row.points = row.match_points + (kind === "playoff" ? row.bonus_points : 0);
    }

    return Array.from(map.values()).sort((a,b) => {
      if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
      return String(a.display_name || "").localeCompare(String(b.display_name || ""), "et");
    });
  }

  const groupCurrent = makeRows("group", null);
  const groupPrevious = latestGroup ? makeRows("group", latestGroup.id) : groupCurrent;

  const playoffCurrent = makeRows("playoff", null);
  const playoffPrevious = latestPlayoff ? makeRows("playoff", latestPlayoff.id) : playoffCurrent;

  const group_leaderboard = addRankMovement(groupCurrent, groupPrevious);
  const playoff_leaderboard = addRankMovement(playoffCurrent, playoffPrevious);

  return json(200, {
    ok: true,
    leaderboard: group_leaderboard,
    group_leaderboard,
    playoff_leaderboard
  });
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
