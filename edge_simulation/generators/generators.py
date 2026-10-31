import random
from typing import Optional
from .noise import SensorNoiseModel

class TelemetryGenerator:
    """
    Simplified telemetry generator that maintains stable, bounded temperature,
    basic compressor cycling, linear shelf-life decay, and sensor noise.
    """

    def __init__(
        self,
        device_id: str = "dev-01",
        target_temp: float = 4.0,
        shelf_life_days: float = 14.0
    ):
        self.device_id = device_id
        self.target_temp = target_temp
        self.current_temp = target_temp
        self.compressor_state = "OFF"
        
        # Shelf life in seconds
        self.total_shelf_life_sec = shelf_life_days * 86400.0
        self.remaining_shelf_life_sec = self.total_shelf_life_sec

        self.noise = SensorNoiseModel()

    def generate_sample(self, elapsed_seconds: float = 2.0) -> dict:
        dt = max(0.0, float(elapsed_seconds))

        # 1. Basic Compressor & Temperature Drift
        # Compressor triggers ON above 5.5°C, turns OFF below 3.5°C
        if self.current_temp >= self.target_temp + 1.5:
            self.compressor_state = "ON"
        elif self.current_temp <= self.target_temp - 0.5:
            self.compressor_state = "OFF"

        # Apply simple temperature delta based on compressor state
        if self.compressor_state == "ON":
            temp_shift = -0.05 * min(dt, 20.0)  # Cools down
        else:
            temp_shift = 0.03 * min(dt, 20.0)   # Warms up slowly

        # Small random ambient fluctuation
        temp_shift += random.uniform(-0.05, 0.05)

        # Update and clamp temperature to a realistic physical cold-room range (1.0°C - 10.0°C)
        self.current_temp = round(max(1.0, min(10.0, self.current_temp + temp_shift)), 2)

        # 2. Sensor Noise & Hardware Drops
        measured_temp = self.noise.add_noise_and_drop(self.current_temp)

        # 3. Simple Linear Shelf-Life Degradation
        # Baseline decay is 1x at <= 4.0°C; accelerates linearly if temperature rises above 4.0°C
        decay_multiplier = 1.0
        if self.current_temp > self.target_temp:
            decay_multiplier += (self.current_temp - self.target_temp) * 0.5

        decay_amount = dt * decay_multiplier
        self.remaining_shelf_life_sec = max(0.0, self.remaining_shelf_life_sec - decay_amount)
        remaining_pct = round((self.remaining_shelf_life_sec / self.total_shelf_life_sec) * 100.0, 2)

        return {
            "true_temperature": self.current_temp,
            "measured_temperature": measured_temp,
            "remaining_shelf_life": remaining_pct,
            "compressor_state": self.compressor_state
        }


if __name__ == "__main__":
    generator = TelemetryGenerator()
    for _ in range(20):
        print(generator.generate_sample(elapsed_seconds=10.0))