import { describe, expect, it } from "vitest";
import { scoreQuiz, type QuizQuestions } from "./quiz";
import { countdownRunning, parseContent, parseSections } from "./sections";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const quiz: QuizQuestions = [
  { id: "q1", text: "One", answers: [{ id: "a", text: "x", productId: A, points: 2 }, { id: "b", text: "y", productId: B, points: 3 }] },
  { id: "q2", text: "Two", answers: [{ id: "c", text: "x", productId: A, points: 2 }, { id: "d", text: "y", productId: B, points: 1 }] },
];

describe("scoreQuiz", () => {
  it("adds each answer's points to its product", () => {
    expect(scoreQuiz(quiz, [0, 0])).toBe(A);
    expect(scoreQuiz(quiz, [1, 1])).toBe(B);
    expect(scoreQuiz(quiz, [1, 0])).toBe(B);
  });
  it("refuses answers that don't fit", () => {
    expect(scoreQuiz(quiz, [0])).toBeNull();
    expect(scoreQuiz(quiz, [0, 5])).toBeNull();
    expect(scoreQuiz([], [])).toBeNull();
  });
});

describe("sections", () => {
  it("checks content against its kind", () => {
    expect(parseContent("hero", { headline: "Hi" })).toEqual({ headline: "Hi", subheadline: "", buttonLabel: "" });
    expect(() => parseContent("faq", { items: [{ question: 3 }] })).toThrow();
    expect(() => parseSections('[{"id":"1","kind":"nope","content":{}}]')).toThrow();
  });
  it("stops a countdown at its end time", () => {
    expect(countdownRunning({ endsAt: "2020-01-01T00:00:00Z" })).toBe(false);
    expect(countdownRunning({ endsAt: "2999-01-01T00:00:00Z" })).toBe(true);
  });
});
