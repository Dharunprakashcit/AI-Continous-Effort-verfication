#!/bin/sh
python api.py &
exec python app.py
