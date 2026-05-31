#!/bin/bash
# Wait for the marketing site to be ready, then open it
wait-on http://localhost:30051 -t 30000 && open http://localhost:30051
