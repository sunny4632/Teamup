import { generateLogo, generateSplashScreen } from './logoGenerator';

async function main() {
  console.log("Generating Logo...");
  const logo = await generateLogo();
  console.log("Logo Generated:", logo ? "Success" : "Failed");
  
  console.log("Generating Splash Screen...");
  const splash = await generateSplashScreen();
  console.log("Splash Screen Generated:", splash ? "Success" : "Failed");

  if (logo) {
    console.log("\n--- LOGO BASE64 ---");
    console.log(logo);
  }
  
  if (splash) {
    console.log("\n--- SPLASH SCREEN BASE64 ---");
    console.log(splash);
  }
}

main().catch(console.error);
