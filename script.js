/*
 * Websensor flight game project
 * https://github.com/jessenie-intel/websensor-flight
 *
 * Copyright (c) 2017 Jesse Nieminen
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
*/

'use strict';

/* Globals */
var latitude = null;
var longitude = null;
const GRAVITY = 9.81;
var orientationMat = new Float64Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);     //device orientation
var sensorfreq = 60;

//Sensor classes and low-pass filter
class AbsOriSensor {
        constructor() {
        const sensor = new AbsoluteOrientationSensor({ frequency: sensorfreq });
        const mat4 = new Float32Array(16);
        const euler = new Float32Array(3);
        sensor.onchange = () => {
                sensor.populateMatrix(mat4);
                toEulerianAngle(sensor.quaternion, euler);      //From quaternion to Eulerian angles
                this.roll = euler[0];
                this.pitch = euler[1];
                this.yaw = euler[2];
                if (this.onchange) this.onchange();
        };
        sensor.onactivate = () => {
                if (this.onactivate) this.onactivate();
        };
        const start = () => sensor.start();
        Object.assign(this, { start });
        }
}
class LowPassFilterData {       //https://w3c.github.io/motion-sensors/#pass-filters
  constructor(reading, bias) {
    Object.assign(this, { x: reading.x, y: reading.y, z: reading.z });
    this.bias = bias;
  }
        update(reading) {
                this.x = this.x * this.bias + reading.x * (1 - this.bias);
                this.y = this.y * this.bias + reading.y * (1 - this.bias);
                this.z = this.z * this.bias + reading.z * (1 - this.bias);
        }
}

//WINDOWS 10 HAS DIFFERENT CONVENTION: Yaw z, pitch x, roll y
function toEulerianAngle(quat, out)
{
        const ysqr = quat[1] ** 2;

        // Roll (x-axis rotation).
        const t0 = 2 * (quat[3] * quat[0] + quat[1] * quat[2]);
        const t1 = 1 - 2 * (ysqr + quat[0] ** 2);
        out[0] = Math.atan2(t0, t1);
        // Pitch (y-axis rotation).
        let t2 = 2 * (quat[3] * quat[1] - quat[2] * quat[0]);
        t2 = t2 > 1 ? 1 : t2;
        t2 = t2 < -1 ? -1 : t2;
        out[1] = Math.asin(t2);
        // Yaw (z-axis rotation).
        const t3 = 2 * (quat[3] * quat[2] + quat[0] * quat[1]);
        const t4 = 1 - 2 * (ysqr + quat[2] ** 2);
        out[2] = Math.atan2(t3, t4);
        return out;
}

//The custom element where the game will be rendered
customElements.define("game-view", class extends HTMLElement {
        constructor() {
        super();

        //THREE.js render stuff
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.target = new THREE.Vector3(0, 0, 0);

        sphere = new THREE.SphereGeometry(100, 100, 40);
        sphere.applyMatrix(new THREE.Matrix4().makeScale(-1, 1, 1));

        //videoTexture = new THREE.Texture(video);
        //videoTexture.minFilter = THREE.LinearFilter;
        //videoTexture.magFilter = THREE.LinearFilter;
        //videoTexture.format = THREE.RGBFormat;

        //sphereMaterial = new THREE.MeshBasicMaterial( { map: videoTexture, overdraw: 0.5 } );
        //sphereMesh = new THREE.Mesh(sphere, sphereMaterial);
        //scene.add(sphereMesh);
        }

        connectedCallback() {
                try {
                //Initialize sensors
                orientation_sensor = new AbsOriSensor();
                orientation_sensor.onchange = () => {
                        this.roll = orientation_sensor.roll;
                        this.pitch = orientation_sensor.pitch;
                        this.yaw = orientation_sensor.yaw;
                        if(!this.initialoriobtained) //obtain initial longitude
                        {
                                let yawInitial = orientation_sensor.yaw;
                                this.longitudeInitial = -yawInitial * 180 / Math.PI;
                                longitudeOffset = this.longitudeInitial;
                                this.initialoriobtained = true;
                        }
                };
                orientation_sensor.onactivate = () => {
                };
                orientation_sensor.start();
                }
                catch(err) {
                        console.log(err.message);
                        console.log("Your browser doesn't seem to support generic sensors. If you are running Chrome, please enable it in about:flags.");
                        this.innerHTML = "Your browser doesn't seem to support generic sensors. If you are running Chrome, please enable it in about:flags";
                }
                this.render();
        }

        render() {
                longitude = -this.yaw * 180 / Math.PI;       /*maybe should change and work instead in radians*/
                //remove offset, scale to 0-360
                longitude = longitude - this.longitudeInitial;
                if(longitude < 0)
                {
                        longitude = longitude + 360;
                }
                latitude = this.roll * 180 / Math.PI - 90;

                //Below based on http://www.emanueleferonato.com/2014/12/10/html5-webgl-360-degrees-panorama-viewer-with-three-js/
                // limiting latitude from -85 to 85 (cannot point to the sky or under your feet)
                latitude = Math.max(-85, Math.min(85, latitude));
                // moving the camera according to current latitude (vertical movement) and longitude (horizontal movement)
                this.camera.target.x = 500 * Math.sin(THREE.Math.degToRad(90 - latitude)) * Math.cos(THREE.Math.degToRad(longitude));
                this.camera.target.y = 500 * Math.cos(THREE.Math.degToRad(90 - latitude));
                this.camera.target.z = 500 * Math.sin(THREE.Math.degToRad(90 - latitude)) * Math.sin(THREE.Math.degToRad(longitude));
                this.camera.lookAt(this.camera.target);

                // Render loop
                this.renderer.render(scene, this.camera);
                requestAnimationFrame(() => this.render());
        }

});
