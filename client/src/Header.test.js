/* eslint-env jest */
/* eslint-disable react/prop-types */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";

jest.mock(
  "react-router-dom",
  () => {
    const React = require("react");

    return {
      MemoryRouter: ({ children }) => <>{children}</>,
      Link: ({ children, to = "/", ...props }) => (
        <a href={to} {...props}>
          {children}
        </a>
      ),
    };
  },
  { virtual: true }
);

describe("Header", () => {
  it("shows the shared contact details in the contact dialog", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /contact/i }));

    expect(screen.getByRole("dialog", { name: /contact us/i })).toBeInTheDocument();
    expect(
      screen.getByText(/nw michigan water quality database project team/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact details are not published yet/i)
    ).toBeInTheDocument();
  });

  it("does not publish an individual name, phone number, or email address", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /contact/i }));

    expect(screen.queryByText(/john ransom/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/benzie/i)).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it("opens the placeholder audio instructions dialog", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Header />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /audio instructions/i }));

    expect(screen.getByRole("dialog", { name: /audio instructions/i })).toBeInTheDocument();
    expect(screen.getByText(/audio playback is not enabled yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/placeholder for future narrated instructions/i)
    ).toBeInTheDocument();
  });
});
