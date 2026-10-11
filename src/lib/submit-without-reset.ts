import { startTransition, type FormEvent } from "react";

/**
 * onSubmit handler for forms whose radios, checkboxes or selects are
 * controlled by React state.
 *
 * React resets a <form action={fn}> after the action finishes. The reset puts
 * those inputs back to their first values on screen while the state behind
 * them stays the same, so what the visitor sees no longer matches what will be
 * sent (for example "Delivery" shown as selected while "Pickup" is remembered).
 * Running the same action from onSubmit inside a transition skips that reset;
 * the form still works without JavaScript through its action attribute, and
 * the submit button still shows its pending state.
 */
export function submitWithoutReset(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = submitter ? new FormData(event.currentTarget, submitter) : new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
}
