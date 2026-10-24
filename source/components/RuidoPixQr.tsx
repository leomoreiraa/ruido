
const rows = [
  "1fd93fbf77f",
  "1058a74ca41",
  "175980df45d",
  "174db6e005d",
  "175de3f2d5d",
  "1048a95a741",
  "1fd5555557f",
  "0005e7d0700",
  "13fb7762597",
  "020273bba85",
  "0eedff27d25",
  "16222132822",
  "157abffeede",
  "19a49258b5a",
  "076b64db547",
  "10863e16544",
  "19d7478864e",
  "0a24f3d9eff",
  "116e1138c2e",
  "170f7f0010e",
  "10c673ec9d6",
  "1f118f57db5",
  "14e3df897ba",
  "1324ac3fc7f",
  "1deb1ce4799",
  "1494c17839e",
  "194cba06866",
  "1e1bededc07",
  "035e37b4f10",
  "12a808bd166",
  "195577545c3",
  "1face31de0b",
  "1cc339f8df3",
  "001aa021f17",
  "1fd2bdc5d5b",
  "1055389a511",
  "175f8e6eff6",
  "1751fb3435c",
  "174c341155b",
  "104d5831257",
  "1fd84205496"
] as const;

const qrPath = rows.flatMap((row, y) => {
  const bits = BigInt("0x" + row);
  const parts: string[] = [];
  for (let x = 0; x < 41; x++) {
    if (((bits >> BigInt(40 - x)) & 1n) !== 0n) {
      parts.push(`M${x + 4} ${y + 4}h1v1h-1z`);
    }
  }
  return parts;
}).join(" ");

export function RuidoPixQr() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 49 49"
      className="block h-auto w-full"
      role="img"
      aria-labelledby="ruido-pix-title ruido-pix-description"
      shapeRendering="crispEdges"
    >
      <title id="ruido-pix-title">QR Code Pix para apoiar o RUÍDO</title>
      <desc id="ruido-pix-description">
        Abra o aplicativo do banco e utilize a função Pix por QR Code.
        O valor é escolhido pelo pagador; confira o nome do destinatário.
      </desc>
      <rect width="49" height="49" fill="#ffffff" />
      <path d={qrPath} fill="#111111" />
    </svg>
  );
}
