import axios from "axios";

export const baseURL = "http://localhost:8080";
// export const baseURL = "https://chatapplicationbackend-eqx4.onrender.com";
export const httpClient = axios.create({
    baseURL: baseURL,
    // timeout: 1000,
    // headers:{
    //     'Content-Type' : 'application/json'
    // }
})