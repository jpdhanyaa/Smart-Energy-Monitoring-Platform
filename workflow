Workflow of AI Smart Energy Management System
The AI Smart Energy Management System monitors energy consumption in real time, controls electrical appliances using an ESP32, and predicts monthly electricity usage and the estimated electricity bill using machine learning.
1. Overall System Workflow
1. Sensor Data Collection: The ESP32 DevKit V1 collects readings from the ACS712 current sensor, PIR motion sensor, and LDR light sensor.

2. Data Processing: The ESP32 processes the sensor readings and determines the current status of the connected appliances. It calculates current and other supported measurements.

3. IoT Communication: The ESP32 connects to Wi-Fi and sends sensor readings to the Mosquitto MQTT broker using the MQTT protocol.

4. Backend Processing: The Node.js and Express.js backend receives the readings, processes incoming data, handles appliance control commands, and stores historical readings in the MySQL database.

5. Web Dashboard: The React-based website receives real-time updates through Socket.IO and displays current consumption, energy usage, appliance status, and consumption charts.

6. Smart Appliance Control: Users can switch the light and fan ON or OFF through the website. Commands travel through the backend and MQTT broker to the ESP32, which operates the corresponding hardware.

7. Automatic Lighting: The PIR sensor detects motion, while the LDR measures ambient light. When motion is detected in a dark environment, the system automatically turns on the light. It switches the light off after a configurable period without motion.

8. Fan Speed Control: Users adjust fan speed through a slider on the webpage. The ESP32 receives the requested speed and uses PWM with a suitable driver to control the 5V DC fan.

9. Energy Usage Calculation: The system accumulates energy consumption in kilowatt-hours (kWh) from valid power measurements over time and stores the results for historical analysis.

10. Machine Learning Prediction: A Python-based machine learning model analyses historical energy consumption and predicts the expected total energy usage for the current month.

11. Electricity Bill Estimation: The predicted monthly consumption is passed to a tariff calculator to estimate the electricity bill in Indian rupees, based on the configured electricity rates and applicable charges.

12. Results Display: The dashboard displays live readings, appliance states, historical energy consumption, predicted monthly usage, and the estimated electricity bill.
2. Software Development Workflow
1. Develop the React frontend and dashboard.
2. Program the ESP32 using Arduino IDE to read sensors and control appliances.
3. Configure Mosquitto and establish MQTT communication.
4. Develop the Node.js backend and connect it to MySQL.
5. Integrate real-time readings into the webpage using Socket.IO.
6. Implement light ON/OFF control, automatic lighting, and PWM fan speed control.
7. Develop and evaluate the machine learning model using Python and Scikit-learn.
8. Integrate the prediction service with the website.
9. Test the complete system with the physical hardware and verify its readings, controls, and predictions.
Expected outcome: A web-based smart energy management system that combines IoT monitoring, automatic appliance control, adjustable fan speed, and AI-based monthly electricity consumption and bill prediction.

Note: The ACS712 measures current only. Accurate real power and household electricity billing require appropriate voltage and power measurements. The ML model should use actual historical energy data and should clearly indicate when insufficient data is available for a reliable prediction.