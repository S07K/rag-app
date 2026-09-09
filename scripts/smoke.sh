#!/usr/bin/env bash
# Smoke test for /chats CRUD. Server must be running on $BASE.
BASE=${BASE:-http://localhost:3000}
J='content-type: application/json'
p(){ printf "%-32s" "$1"; }

ID=$(curl -s -X POST $BASE/chats -H "$J" -d '{"title":"  smoke chat  "}' \
     | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "created id: $ID"; echo

p "POST   /chats (valid)";      curl -s -m 5 -X POST $BASE/chats -H "$J" -d '{"title":"second"}'   -w "  [%{http_code}]\n" -o /dev/null
p "POST   /chats (empty)";      curl -s -m 5 -X POST $BASE/chats -H "$J" -d '{"title":""}'         -w "  [%{http_code}]\n"
p "POST   /chats (no body)";    curl -s -m 5 -X POST $BASE/chats -H "$J" -d '{}'                   -w "  [%{http_code}]\n"
p "GET    /chats";              curl -s -m 5 $BASE/chats                                           -w "  [%{http_code}]\n" -o /dev/null
p "GET    /chats/:id";          curl -s -m 5 $BASE/chats/$ID                                       -w "  [%{http_code}]\n"
p "GET    /chats/nope";         curl -s -m 5 $BASE/chats/nope                                      -w "  [%{http_code}]\n"
p "PATCH  /chats/:id";          curl -s -m 5 -X PATCH $BASE/chats/$ID -H "$J" -d '{"title":"renamed"}' -w "  [%{http_code}]\n"
p "PATCH  /chats/nope";         curl -s -m 5 -X PATCH $BASE/chats/nope -H "$J" -d '{"title":"x"}'  -w "  [%{http_code}]\n"
p "DELETE /chats/:id";          curl -s -m 5 -X DELETE $BASE/chats/$ID                             -w "  [%{http_code}]\n"
p "DELETE /chats/:id (again)";  curl -s -m 5 -X DELETE $BASE/chats/$ID                             -w "  [%{http_code}]\n"
