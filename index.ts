import fs from "fs";
import cron from "node-cron";
import { apikey, nif, pin } from "./config.json";

const API = "https://www.tiqapp.es/app/tiqapp.aspx";
const HOLIDAYS_API = "https://openholidaysapi.org/PublicHolidays";

const validateCredentials = async () => {
  const response = await fetch(API, {
    method: "POST",
    body: formDataFromJSON({
      apikey,
      op: "VALIDARNIF",
      nif,
      pin,
    }),
  });

  if (!response.ok) {
    throw Error("Failed to fetch");
  }

  const data = await response.json();
  return data;
};

const runAction = async (vars: {
  cif: string;
  MarcaTiempo: string;
  Accion: "Entrada" | "Salida";
}) => {
  const response = await fetch(API, {
    method: "POST",
    body: formDataFromJSON({
      apikey,
      pin,
      op: "FICHAR",
      nif,
      Equipo: "WEBAPP",
      Usuario: "Mozilla Netscape MacIntel",
      FingerPrint: "",
      Motivo: "",
      GeoLocation: "No se ha permitido el acceso a la posición del usuario.",
      PictureJPG_Base64:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDACgcHiMeGSgjISMtKygwPGRBPDc3PHtYXUlkkYCZlo+AjIqgtObDoKrarYqMyP/L2u71////m8H////6/+b9//j/2wBDASstLTw1PHZBQXb4pYyl+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj/wAARCADwAUADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/2Q==",
      ...vars,
    }),
  });

  if (!response.ok) {
    throw Error("Failed to fetch");
  }

  const data = await response.text();
  return data;
};

const checkDayOff = async () => {
  const holidaysdata = fs.readFileSync("./holidays.json", "utf8");
  const SKIPREGISTERDATES = JSON.parse(holidaysdata);
  const today = getNow().split(" ")[0];

  if (SKIPREGISTERDATES.indexOf(today) !== -1) {
    return true;
  }

  const response = await fetch(
    `${HOLIDAYS_API}?countryIsoCode=ES&validFrom=${today}&validTo=${today}&subdivisionCode=ES-MD`
  );
  if (!response.ok) {
    throw Error("Failed to fetch holidays");
  }
  const data = await response.json();
  return data.length > 0;
};

const entryAction = async () => {
  const isDayOff = await checkDayOff();
  if (isDayOff) return;
  const data = await validateCredentials();
  if (!("Empresas" in data)) {
    console.error("Failed to fetch company details");
    return;
  }
  const [companyData] = data["Empresas"];
  const response = await runAction({
    cif: companyData.CIF,
    MarcaTiempo: getNow(),
    Accion: "Entrada",
  });

  console.log("🚀 ~ entryAction ~ response:", response);
};

const exitAction = async () => {
  const isDayOff = await checkDayOff();
  if (isDayOff) return;
  const data = await validateCredentials();
  if (!("Empresas" in data)) {
    console.error("Failed to fetch company details");
    return;
  }
  const [companyData] = data["Empresas"];
  const response = await runAction({
    cif: companyData.CIF,
    MarcaTiempo: getNow(),
    Accion: "Salida",
  });

  console.log("🚀 ~ exitAction ~ response:", response);
};

const formDataFromJSON = (data: any) => {
  const formData = new FormData();
  for (const key in data) {
    formData.append(key, data[key]);
  }
  return formData;
};

function getNow() {
  const date = new Date();

  const padZero = (num) => num.toString().padStart(2, "0");

  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1); // Months are zero-indexed
  const day = padZero(date.getDate());
  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());
  const seconds = padZero(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

cron.schedule("0 8 * * 1-5", () => {
  entryAction();
});

cron.schedule("30 17 * * 1-4", () => {
  exitAction();
});

cron.schedule("0 15 * * 5", () => {
  exitAction();
});
