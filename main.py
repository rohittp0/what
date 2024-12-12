import json
from datetime import datetime, timedelta

import requests

tinker_stations = "ERN", "ERS", "AWY", "KLMR", "IPL"
train_base_url = "https://whereismytrain.in/cache/live_station?station_code="
th_base_url = "https://app-api.tinkerhub.org/"

th_headers = {
    "Content-Type": "application/json",
    "host": "app-api.tinkerhub.org",
    "app-version": "189",
    "user-agent": "Dart/3.5 (dart:io)"
}


def send_otp(phone: str):
    response = requests.post(th_base_url + "user/otp", json={"phoneNumber": phone}, headers=th_headers)
    return response.text


def login(phone: str, otp: str):
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
        return data["token"], data["refreshToken"]
    except FileNotFoundError:
        return None


def request_with_auth(method, path, **kwargs):
    token, refresh = get_token()
    try:
        response = requests.request(method, th_base_url + path, headers={**th_headers, "authorization": token},
                                    **kwargs)
        response.raise_for_status()
        return response
    except requests.exceptions.HTTPError as e:
        if e.response.status_code != 401:
            raise e

        response = requests.get(th_base_url + "auth/refresh",
                                headers={**th_headers, "authorization": refresh})
        print(response.text)
        response.raise_for_status()

        data = response.json()
        json.dump(data, open("auth.json", "w"))
        return request_with_auth(method, path, **kwargs)


def get_trains():
    trains = []
    for station in tinker_stations:
        response = requests.get(train_base_url + station)
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
                    "train": f"{train['train_name']} ( {train['train_no']} )",
                    "cur_stn": train["cur_stn"],
                    "train_time": train_time,
                    "event": event,
                    "time_diff": (event_time - train_time)
                })

    return matched


def main():
    if not get_token():
        phone = f'+91{input("Enter your phone number: ")}'
        print(send_otp(phone))

        login(phone, input("Enter OTP: "))
        print("Logged in successfully")

    events = get_all_events()
    trains = get_trains()

    while True:
        wait = input("How patient are you? (in minutes): ")
        matched = match_events(trains, events, timedelta(minutes=int(wait)))
        print("Found these trains that will take you to an event:")

        for match in matched:
            print(f"{match['train']} is at {match['cur_stn']} and will reach "
                  f"{match['time_diff']} before the event {match['event']['name']}")

        if not matched:
            print("No matches found")

        input("Press enter to check again")


if __name__ == '__main__':
    main()
