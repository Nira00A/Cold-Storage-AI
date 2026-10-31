import time
import uuid
import random
from datetime import datetime, timezone
from ..config import config
from ..database.database import LocalDatabase
from ..generators.generators import TelemetryGenerator

class EdgeDevice:
    """Manages autonomous device simulation, sensor reading, and local outbox buffering."""

    def __init__(self, device_id: str, db: LocalDatabase):
        self.device_id = device_id
        self.db = db
        self.generator = TelemetryGenerator(device_id)
        self.sequence_number = db.get_next_sequence_number(device_id)
        self.cycle = 0
        self.previous_fault_cycle = False
        self.fault_duration_cycles = config.FAULT_DURATION_CYCLES
        self.fault_event_index = 0
        fault_period = max(1, config.FAULT_EVERY_CYCLES)
        device_offset = sum(ord(char) for char in self.device_id)
        self.fault_phase_offset = (device_offset + random.randrange(fault_period)) % fault_period
        self.running = False

    def run(self):
        self.running = True
        last_tick = time.time()

        while self.running:
            now = time.time()
            dt = now - last_tick
            last_tick = now
            self.cycle += 1

            timestamp = datetime.now(timezone.utc).isoformat()
            is_heartbeat = (self.sequence_number % config.HEARTBEAT_INTERVAL_CYCLES == 0)
            fault_position = (
                (self.cycle + self.fault_phase_offset) % config.FAULT_EVERY_CYCLES
                if config.FAULT_EVERY_CYCLES > 0
                else -1
            )
            if fault_position == 0:
                self.fault_duration_cycles = config.FAULT_DURATION_CYCLES + random.randint(0, 3)
                self.fault_event_index += 1
            fault_cycle = fault_position >= 0 and fault_position < self.fault_duration_cycles

            # Generate readings
            sample = self.generator.generate_sample(elapsed_seconds=dt)
            if fault_cycle:
                sample["measured_temperature"] = round(
                    random.uniform(config.CRITICAL_TEMP_C + 0.3, 9.9), 2
                )
            elif self.previous_fault_cycle:
                sample["measured_temperature"] = config.COOLING_SETPOINT_C
            self.previous_fault_cycle = fault_cycle
            hardware_failed = (sample["measured_temperature"] is None)

            record = {
                "id": str(uuid.uuid4()),
                "device_id": self.device_id,
                "sequence_number": self.sequence_number,
                "timestamp": timestamp,
                "payload_type": "HEARTBEAT" if is_heartbeat else "READING",
                "measured_temperature": sample["measured_temperature"],
                "true_temperature": sample["true_temperature"],
                "remaining_shelf_life": sample["remaining_shelf_life"],
                "compressor_state": sample["compressor_state"]
            }

            # Buffer to local SQLite outbox
            self.db.insert_record(record)
            self.sequence_number += 1

            time.sleep(config.POLL_INTERVAL_SEC)

    def stop(self):
        self.running = False