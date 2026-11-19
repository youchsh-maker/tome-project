import { expect, test } from "@playwright/test";

test("홈 화면이 열리고 역 검색 입력이 보인다", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Locker Radar");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Find a free locker");
  await expect(page.getByRole("textbox", { name: "Station name" })).toBeVisible();
});
