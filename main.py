from flask import Flask, request, jsonify, send_from_directory
import json
from datetime import datetime, timedelta
import requests
import os

app = Flask(__name__, static_folder='public')

tinker_stations = ("ERN", "ERS", "AWY", "KLMR", "IPL")
train_base_url = "https://whereismytrain.in/cache/live_station?station_code="
th_base_url = "https://app-api.tinkerhub.org/"

th_headers = {
    "Content-Type": "application/json",
    "host": "app-api.tinkerhub.org",
    "app-version": "189",
    "user-agent": "Dart/3.5 (dart:io)"
}


def send_otp_internal(phone: str):
    response = requests.post(th_base_url + "user/otp", json={"phoneNumber": phone}, headers=th_headers)
    return response.text


def login_internal(phone: str, otp: str):
    response = requests.post(th_base_url + "user/otp/verify",
                             json={"phoneNumber": phone, "otp": otp},
                             headers=th_headers)
    response.raise_for_status()

    data = response.json()
    json.dump(data, open("auth.json", "w"))

    return data["token"]


def get_token():
    try:
        data = json.load(open("auth.json", "r"))
        return data["token"], data["refreshToken"], data["phoneNumber"]
    except FileNotFoundError:
        return None, None, None


def request_with_auth(method, path, **kwargs):
    token, refresh, phone = get_token()
    if not token or not refresh:
        raise ValueError("Not logged in. No token found.")
    try:
        response = requests.request(method, th_base_url + path, headers={**th_headers, "authorization": token},
                                    **kwargs)
        response.raise_for_status()
        return response
    except requests.exceptions.HTTPError as e:
        if e.response.status_code != 401:
            raise e

        # Refresh token if 401
        response = requests.post(th_base_url + "auth/refresh",
                                 json={"phoneNumber": phone},
                                 headers={**th_headers, "authorization": refresh})
        response.raise_for_status()

        data = response.json()
        data["phoneNumber"] = phone

        json.dump(data, open("auth.json", "w"))
        return request_with_auth(method, path, **kwargs)


def get_trains_internal():
    trains = []
    for station in tinker_stations:
        response = requests.get(train_base_url + station)
        response.raise_for_status()
        data = response.json()["live_station_info"]
        for train in data:
            if train["diverted"] or train["cancelled"] or train["arrived"]:
                continue

            # Calculate arrival date time as datetime object
            arrival_date_time = datetime.strptime(train["scheduled_arrival"], "%Y-%m-%dT%H:%M:%S%z")
            if train["delay_in_arrival"] != "RIGHT TIME":
                arrival_delay = datetime.strptime(train["delay_in_arrival"], "%H:%M")
                arrival_date_time += timedelta(hours=arrival_delay.hour, minutes=arrival_delay.minute)

            trains.append({
                "train_no": train["train_no"],
                "train_name": train["train_name"],
                "scheduled_arrival": arrival_date_time,
                "cur_stn": train["cur_stn"]
            })

    return trains


def get_all_events():
    response = request_with_auth("GET", "event/space").json()["data"]
    events = []
    for event in response:
        events.append({
            "name": event["name"],
            "description": event["description"],
            "date": datetime.strptime(event["startDate"], "%Y-%m-%dT%H:%M:%S%z")
        })
    return events


def match_events(trains, events, wait_time):
    matched = []
    for train in trains:
        for event in events:
            train_time, event_time = train["scheduled_arrival"], event["date"]
            if train_time <= event_time <= train_time + wait_time:
                matched.append({
                    "train": f"{train['train_name']} ({train['train_no']})",
                    "cur_stn": train["cur_stn"],
                    "train_time": train_time.isoformat(),
                    "event": {
                        "name": event["name"],
                        "description": event["description"],
                        "date": event["date"].isoformat()
                    },
                    "time_diff": (event_time - train_time).total_seconds()
                })
    return matched


@app.route('/send_otp', methods=['POST'])
def send_otp():
    # Expecting JSON: { "phone": "+91XXXXXXXXXX" }
    data = request.get_json()
    phone = data.get("phone")
    if not phone:
        return jsonify({"error": "Phone number is required"}), 400
    result = send_otp_internal(phone)
    return jsonify({"message": "OTP sent", "response": result})


@app.route('/login', methods=['POST'])
def login():
    # Expecting JSON: { "phone": "+91XXXXXXXXXX", "otp": "123456" }
    data = request.get_json()
    phone = data.get("phone")
    otp = data.get("otp")
    if not phone or not otp:
        return jsonify({"error": "Phone and OTP are required"}), 400
    token = login_internal(phone, otp)
    return jsonify({"message": "Logged in successfully", "token": token})


@app.route('/get_trains', methods=['GET'])
def get_trains():
    # Query param: wait (in minutes)
    wait_str = request.args.get("wait")
    if not wait_str or not wait_str.isdigit():
        return jsonify({"error": "Please provide wait time in minutes as a numeric value"}), 400

    wait_minutes = int(wait_str)
    wait_time = timedelta(minutes=wait_minutes)

    token, _, _ = get_token()
    if not token:
        return jsonify({"error": "Not logged in"}), 401

    events = get_all_events()
    trains = get_trains_internal()
    matched = match_events(trains, events, wait_time)

    return jsonify({"matched_trains": matched})


@app.route('/members/<page>')
def member(page):
    page = int(page or 1)
    response = request_with_auth("GET", f"member/invite/m/{page}").json()
    return jsonify(response["data"])


@app.route('/member/<uid>')
def member_detail(uid):
    response = request_with_auth("GET", f"member/{uid}").json()
    return jsonify(response)


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    # Serve static files from the public folder
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        # If no file is found, serve index.html (if you have one)
        # Otherwise, just return 404
        index_path = os.path.join(app.static_folder, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(app.static_folder, 'index.html')
        else:
            return "File not found", 404


if __name__ == '__main__':
    # Run the Flask app on http://localhost:5000
    app.run(host='0.0.0.0', port=5000, debug=True)
